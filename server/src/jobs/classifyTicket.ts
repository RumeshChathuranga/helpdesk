import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { z } from "zod";
import { ticketCategorySchema, type TicketCategory } from "core";
import type { Job } from "pg-boss";
import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";

// ─── Job contract ─────────────────────────────────────────────────────────────

export const CLASSIFY_TICKET_QUEUE = "classify-ticket" as const;

export interface ClassifyTicketJobData {
  ticketId: string;
  subject: string;
  body: string;
}

// ─── Category descriptions ────────────────────────────────────────────────────

/**
 * Single source of truth for categories + their AI prompt descriptions.
 * Record<TicketCategory, string> is exhaustive — TypeScript will error if a
 * new category is added to the enum but not here.
 */
const CATEGORY_DESCRIPTIONS: Record<TicketCategory, string> = {
  BILLING: "Payment issues, invoices, subscriptions, refunds, pricing questions",
  TECHNICAL: "Technical problems, errors, crashes, performance issues, integrations",
  GENERAL: "General inquiries, how-to questions, documentation requests",
  FEATURE_REQUEST: "Requests for new features or product enhancements",
  BUG: "Reports of broken functionality or unexpected behavior",
  OTHER: "Anything that does not fit the above categories",
};

const categoryPromptLines = (
  Object.entries(CATEGORY_DESCRIPTIONS) as [TicketCategory, string][]
)
  .map(([cat, desc]) => `- ${cat}: ${desc}`)
  .join("\n");

const classificationSchema = z.object({
  category: ticketCategorySchema,
});

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Registers the classify-ticket worker with pg-boss.
 * Must be called once after boss.start() during server startup.
 */
export async function registerClassifyTicketWorker(): Promise<void> {
  await boss.createQueue(CLASSIFY_TICKET_QUEUE);

  await boss.work<ClassifyTicketJobData>(
    CLASSIFY_TICKET_QUEUE,
    async (jobs: Job<ClassifyTicketJobData>[]) => {
      const job = jobs[0];
      if (!job) return;
      const { ticketId, subject, body } = job.data;

      const githubToken = process.env.GITHUB_MODELS_TOKEN;
      if (!githubToken) {
        // Throwing here lets pg-boss retry the job later if the token gets set
        throw new Error("GITHUB_MODELS_TOKEN not set");
      }

      const githubModels = createOpenAICompatible({
        name: "github-models",
        apiKey: githubToken,
        baseURL: "https://models.inference.ai.azure.com",
      });

      const { text } = await generateText({
        model: githubModels("o4-mini"),
        system: `You are a helpdesk ticket classifier. Classify the given support ticket into exactly one of these categories:\n${categoryPromptLines}\n\nRespond with ONLY a JSON object in this exact format: {"category": "<CATEGORY>"}\nDo not include any explanation or extra text — only the json object.`,
        prompt: `Subject: ${subject}\n\nBody:\n${body}`,
      });

      const parsed = classificationSchema.safeParse(JSON.parse(text.trim()));
      if (!parsed.success) {
        throw new Error(`Unexpected AI response: ${text}`);
      }

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { category: parsed.data.category },
      });

      console.info(
        `[classify-ticket] Ticket ${ticketId} classified as ${parsed.data.category}`,
      );
    },
  );

  console.log(`[pg-boss] Worker registered for queue: ${CLASSIFY_TICKET_QUEUE}`);
}

// ─── Enqueue helper ───────────────────────────────────────────────────────────

/**
 * Enqueues a classify-ticket job. Returns the job ID.
 * Safe to call without awaiting the return value (fire-and-forget at the call site),
 * but the job itself is persisted in Postgres — no data loss on process crash.
 */
export async function enqueueClassifyTicket(
  data: ClassifyTicketJobData,
): Promise<string | null> {
  return boss.send(CLASSIFY_TICKET_QUEUE, data);
}
