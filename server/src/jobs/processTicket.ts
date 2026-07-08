import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { z } from "zod";
import { pipeline } from "@huggingface/transformers";
import { ticketCategorySchema, type TicketCategory } from "core";
import type { Job } from "pg-boss";
import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";

// ─── Job contract ─────────────────────────────────────────────────────────────

export const PROCESS_TICKET_QUEUE = "process-ticket" as const;

export interface ProcessTicketJobData {
  ticketId: string;
  subject: string;
  body: string;
}

// ─── Category descriptions ────────────────────────────────────────────────────

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

// ─── Response schemas ─────────────────────────────────────────────────────────

const classificationSchema = z.object({
  category: ticketCategorySchema,
});

const resolutionSchema = z.object({
  resolved: z.boolean(),
  reply: z.string().optional(),
});

// ─── Knowledge base loader (Removed in favor of RAG) ──────────────────────────

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Registers the process-ticket worker with pg-boss.
 * Handles: status → PROCESSING, category classification, KB resolution.
 * Must be called once after boss.start() during server startup.
 */
export async function registerProcessTicketWorker(): Promise<void> {
  await boss.createQueue(PROCESS_TICKET_QUEUE);

  await boss.work<ProcessTicketJobData>(
    PROCESS_TICKET_QUEUE,
    async (jobs: Job<ProcessTicketJobData>[]) => {
      const job = jobs[0];
      if (!job) return;
      const { ticketId, subject, body } = job.data;

      const githubToken = process.env.GITHUB_MODELS_TOKEN;
      if (!githubToken) {
        throw new Error("GITHUB_MODELS_TOKEN not set");
      }

      // Find AI agent
      const aiAgent = await prisma.user.findUnique({ where: { email: "ai@example.com" } });

      const currentTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { assignedToId: true },
      });

      // Mark as PROCESSING so agents don't see it while AI works on it
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: "PROCESSING",
          assignedToId: currentTicket?.assignedToId ?? aiAgent?.id,
        },
      });

      console.info(`[process-ticket] Ticket ${ticketId} → PROCESSING`);

      const githubModels = createOpenAICompatible({
        name: "github-models",
        apiKey: githubToken,
        baseURL: "https://models.inference.ai.azure.com",
      });

      // ── Step 1: Classify ──────────────────────────────────────────────────
      let category: TicketCategory = "OTHER";
      try {
        const { text: classifyText } = await generateText({
          model: githubModels("o4-mini"),
          system: `You are a helpdesk ticket classifier. Classify the given support ticket into exactly one of these categories:\n${categoryPromptLines}\n\nRespond with ONLY a JSON object in this exact format: {"category": "<CATEGORY>"}\nDo not include any explanation or extra text — only the json object.`,
          prompt: `Subject: ${subject}\n\nBody:\n${body}`,
        });

        const parsed = classificationSchema.safeParse(
          JSON.parse(classifyText.trim()),
        );
        if (parsed.success) {
          category = parsed.data.category;
        }
      } catch (err) {
        console.warn(
          `[process-ticket] Classification failed for ${ticketId}, using OTHER:`,
          err,
        );
      }

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { category },
      });

      console.info(
        `[process-ticket] Ticket ${ticketId} classified as ${category}`,
      );

      // ── Step 2: Attempt KB resolution using RAG ──────────────────────────────
      let knowledgeBase = "";
      try {
        const textToEmbed = `Subject: ${subject}\n\nBody:\n${body}`;
        
        // Generate embedding
        const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
        const output = await extractor(textToEmbed, { pooling: "mean", normalize: true });
        const embeddingArray = Array.from(output.tolist()[0] as number[]);
        const vectorString = `[${embeddingArray.join(',')}]`;

        // Retrieve similar chunks
        const chunks = await prisma.$queryRaw<{ text: string, similarity: number }[]>`
          SELECT text, 1 - (embedding <=> ${vectorString}::vector) AS similarity
          FROM "KnowledgeChunk"
          WHERE 1 - (embedding <=> ${vectorString}::vector) > 0.75
          ORDER BY similarity DESC
          LIMIT 3
        `;

        if (chunks.length === 0) {
          console.info(`[process-ticket] No relevant KB chunks found for ${ticketId}, escalating to OPEN.`);
          await prisma.ticket.update({
            where: { id: ticketId },
            data: { status: "OPEN" },
          });
          return;
        }
        knowledgeBase = chunks.map(c => c.text).join("\n\n---\n\n");
      } catch (err) {
        console.warn(
          `[process-ticket] RAG retrieval failed for ${ticketId}, escalating to OPEN:`,
          err,
        );
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: "OPEN" },
        });
        return;
      }

      let resolved = false;
      let aiReply: string | undefined;

      try {
        const { text: resolveText } = await generateText({
          model: githubModels("o4-mini"),
          system: `You are a helpful customer support AI for "Code with Mosh". Your job is to resolve support tickets using the knowledge base provided below.

## Knowledge Base
${knowledgeBase}

## Instructions
1. Read the customer's ticket carefully.
2. Check if the knowledge base contains a clear, complete answer.
3. If YES, write a friendly, professional reply using only the information in the knowledge base.
4. If NO (issue is outside the KB, involves refunds outside policy, legal threats, chargebacks, account security, or your confidence is low), do NOT attempt to answer.

## Escalation Rules — ALWAYS escalate (resolved: false) if:
- The user threatens legal action or mentions lawyers/lawsuits
- The user requests a refund outside the 30-day window
- The user disputes a charge or mentions a chargeback
- The issue involves account security concerns (hacking, unauthorized access)
- You are not confident in the answer

Respond with ONLY a JSON object:
{"resolved": true, "reply": "<your reply here>"}
or
{"resolved": false}

Do not include any explanation outside the JSON.`,
          prompt: `Subject: ${subject}\n\nCustomer message:\n${body}`,
        });

        const parsed = resolutionSchema.safeParse(
          JSON.parse(resolveText.trim()),
        );

        if (parsed.success) {
          resolved = parsed.data.resolved;
          aiReply = parsed.data.reply;
        } else {
          console.warn(
            `[process-ticket] Unexpected resolution response for ${ticketId}: ${resolveText}`,
          );
        }
      } catch (err) {
        console.warn(
          `[process-ticket] Resolution AI call failed for ${ticketId}, escalating to OPEN:`,
          err,
        );
      }

      if (resolved && aiReply) {
        // Create the AI reply and mark ticket as RESOLVED
        await prisma.$transaction([
          prisma.reply.create({
            data: {
              ticketId,
              body: aiReply,
              isAi: true,
            },
          }),
          prisma.ticket.update({
            where: { id: ticketId },
            data: { status: "RESOLVED" },
          }),
        ]);

        console.info(
          `[process-ticket] Ticket ${ticketId} auto-resolved by AI ✓`,
        );
      } else {
        // Can't answer — pass to human agents
        const currentTicket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { assignedToId: true },
        });

        const shouldUnassign = aiAgent && currentTicket?.assignedToId === aiAgent.id;

        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: "OPEN",
            ...(shouldUnassign ? { assignedToId: null } : {}),
          },
        });

        console.info(
          `[process-ticket] Ticket ${ticketId} escalated to OPEN (AI could not resolve)`,
        );
      }
    },
  );

  console.log(`[pg-boss] Worker registered for queue: ${PROCESS_TICKET_QUEUE}`);
}

// ─── Enqueue helper ───────────────────────────────────────────────────────────

/**
 * Enqueues a process-ticket job. Returns the job ID.
 * Safe to fire-and-forget — job is persisted in Postgres.
 */
export async function enqueueProcessTicket(
  data: ProcessTicketJobData,
): Promise<string | null> {
  return boss.send(PROCESS_TICKET_QUEUE, data);
}
