import { Prisma } from "@prisma/client";
import {
  createKnowledgeBodySchema,
  listKnowledgeQuerySchema,
  type CreateKnowledgeBody,
  type ListKnowledgeQuery,
} from "core";
import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { enqueueEmbedDocument } from "../jobs/embed-document.js";

export const knowledgeRouter: IRouter = Router();

/** List rows deliberately omit `text` — a page of ten 50k-character documents
 *  would otherwise ship half a megabyte the UI never renders. Full text comes
 *  from GET /:id. */
const documentListSelect = {
  id: true,
  title: true,
  status: true,
  chunkCount: true,
  error: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.KnowledgeDocumentSelect;

/** Express 5 types a route param as `string | string[]`; narrow it like users.ts does. */
function parseRouteId(id: string | string[] | undefined): string | undefined {
  return typeof id === "string" ? id : id?.[0];
}

knowledgeRouter.get(
  "/",
  requireAdmin,
  validateQuery(listKnowledgeQuerySchema),
  async (req, res) => {
    const { status, search, page, pageSize } =
      req.query as unknown as ListKnowledgeQuery;

    const where: Prisma.KnowledgeDocumentWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { text: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [documents, total] = await prisma.$transaction([
      prisma.knowledgeDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: documentListSelect,
      }),
      prisma.knowledgeDocument.count({ where }),
    ]);

    res.json({ documents, total, page, pageSize });
  },
);

knowledgeRouter.get("/:id", requireAdmin, async (req, res) => {
  const id = parseRouteId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid knowledge document id" });
    return;
  }

  const document = await prisma.knowledgeDocument.findUnique({
    where: { id },
    select: {
      ...documentListSelect,
      text: true,
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: { id: true, chunkIndex: true, text: true },
      },
    },
  });

  if (!document) {
    res.status(404).json({ error: "Knowledge document not found" });
    return;
  }

  res.json({ document });
});

knowledgeRouter.post(
  "/",
  requireAdmin,
  validateBody(createKnowledgeBodySchema),
  async (req, res) => {
    const { title, text } = req.body as CreateKnowledgeBody;

    // The row is created synchronously so the UI can show the document straight
    // away as PENDING; the worker chunks and embeds it in the background.
    const document = await prisma.knowledgeDocument.create({
      data: { title, text },
      select: documentListSelect,
    });

    await enqueueEmbedDocument({ documentId: document.id });

    res.status(201).json({ document });
  },
);

knowledgeRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseRouteId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid knowledge document id" });
    return;
  }

  try {
    // Chunks cascade via the KnowledgeChunk -> KnowledgeDocument foreign key.
    await prisma.knowledgeDocument.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Knowledge document not found" });
      return;
    }
    throw error;
  }
});
