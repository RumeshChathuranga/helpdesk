import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { ticketCategorySchema, type TicketCategory } from "core";

/**
 * Descriptions used both in the AI prompt and as the exhaustive map of valid categories.
 *
 * ADDING/REMOVING A CATEGORY:
 *  1. Update `TicketCategory` enum in `packages/core/src/ticketEnums.ts`
 *  2. Add/remove the corresponding entry here — TypeScript will error if this map
 *     is missing any value from the `TicketCategory` union (Record exhaustiveness).
 *  3. Run `prisma migrate` to update the DB enum.
 */
const CATEGORY_DESCRIPTIONS: Record<TicketCategory, string> = {
  BILLING: "Payment issues, invoices, subscriptions, refunds, pricing questions",
  TECHNICAL: "Technical problems, errors, crashes, performance issues, integrations",
  GENERAL: "General inquiries, how-to questions, documentation requests",
  FEATURE_REQUEST: "Requests for new features or product enhancements",
  BUG: "Reports of broken functionality or unexpected behavior",
  OTHER: "Anything that does not fit the above categories",
};

// Derived from the map — stays in sync automatically
const categoryPromptLines = (Object.entries(CATEGORY_DESCRIPTIONS) as [TicketCategory, string][])
  .map(([cat, desc]) => `- ${cat}: ${desc}`)
  .join("\n");

const classificationSchema = z.object({
  // Reuse ticketCategorySchema from core — no duplicated enum values
  category: ticketCategorySchema,
});

/**
 * Classifies a ticket using AI and updates the category in the database.
 * This function is designed to be called in a fire-and-forget manner (non-blocking).
 * It silently handles errors to avoid crashing the caller.
 */
export async function classifyTicket(
  ticketId: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    const githubToken = process.env.GITHUB_MODELS_TOKEN;
    if (!githubToken) {
      console.warn("[classifyTicket] GITHUB_MODELS_TOKEN not set – skipping classification");
      return;
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

    // Parse and validate the response
    const parsed = classificationSchema.safeParse(JSON.parse(text.trim()));
    if (!parsed.success) {
      console.error(`[classifyTicket] Unexpected response for ticket ${ticketId}:`, text);
      return;
    }

    const category: TicketCategory = parsed.data.category;

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { category },
    });

    console.info(`[classifyTicket] Ticket ${ticketId} classified as ${category}`);
  } catch (err) {
    // Non-blocking: log the error but do not propagate
    console.error(`[classifyTicket] Failed to classify ticket ${ticketId}:`, err);
  }
}
