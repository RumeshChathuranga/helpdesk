import { FIELD_LIMITS } from "core";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { validateBody } from "../middleware/validate.js";
import { enqueueEmbedDocument } from "../jobs/embed-document.js";

export const knowledgeRouter: IRouter = Router();

knowledgeRouter.get("/", requireAdmin, async (_req, res) => {
  try {
    const chunks = await prisma.$queryRaw<{ id: string; text: string }[]>`
      SELECT id, text FROM "KnowledgeChunk" ORDER BY id ASC
    `;
    res.json({ chunks });
  } catch (error) {
    console.error("Error fetching knowledge chunks:", error);
    res.status(500).json({ error: "Failed to fetch knowledge chunks" });
  }
});

const createKnowledgeSchema = z.object({
  text: z
    .string()
    .min(1, "Text is required")
    .max(
      FIELD_LIMITS.body,
      `Text must be at most ${FIELD_LIMITS.body} characters`,
    ),
});

knowledgeRouter.post(
  "/",
  requireAdmin,
  validateBody(createKnowledgeSchema),
  async (req, res) => {
    try {
      const { text } = req.body;
      
      // Enqueue the background job to generate embedding and save to DB
      await enqueueEmbedDocument({ text });
      
      res.status(202).json({ success: true, message: "Knowledge queued for processing" });
    } catch (error) {
      console.error("Error queueing knowledge:", error);
      res.status(500).json({ error: "Failed to queue knowledge" });
    }
  }
);

knowledgeRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Using raw query to delete in case Prisma has issues with unsupported fields in generated typings
    await prisma.$executeRaw`
      DELETE FROM "KnowledgeChunk" WHERE id = ${id}
    `;
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting knowledge chunk ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to delete knowledge chunk" });
  }
});
