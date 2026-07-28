import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";

export const knowledgeStatusValues = [
  "PENDING",
  "PROCESSING",
  "READY",
  "FAILED",
] as const;

export const knowledgeStatusSchema = z.enum(knowledgeStatusValues);

export type KnowledgeStatus = z.infer<typeof knowledgeStatusSchema>;

/** Title shown in the admin list; reuses the subject limit since it plays the same role. */
export const createKnowledgeBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(
      FIELD_LIMITS.subject,
      `Title must be at most ${FIELD_LIMITS.subject} characters`,
    ),
  text: z
    .string()
    .trim()
    .min(1, "Text is required")
    .max(
      FIELD_LIMITS.body,
      `Text must be at most ${FIELD_LIMITS.body} characters`,
    ),
});

export type CreateKnowledgeBody = z.infer<typeof createKnowledgeBodySchema>;

export const DEFAULT_KNOWLEDGE_PAGE_SIZE = 10;

export const listKnowledgeQuerySchema = z.object({
  status: knowledgeStatusSchema.optional(),
  search: z
    .string()
    .trim()
    .max(
      FIELD_LIMITS.search,
      `Search must be at most ${FIELD_LIMITS.search} characters`,
    )
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be at most 100")
    .optional()
    .default(DEFAULT_KNOWLEDGE_PAGE_SIZE),
});

export type ListKnowledgeQuery = z.infer<typeof listKnowledgeQuerySchema>;
