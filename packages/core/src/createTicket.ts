import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";
import { sanitizePlainText } from "./sanitizePlainText.js";
import { ticketCategorySchema } from "./ticketEnums.js";

export const createTicketBodySchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(
      FIELD_LIMITS.subject,
      `Subject must be at most ${FIELD_LIMITS.subject} characters`,
    )
    .transform(sanitizePlainText),
  body: z
    .string()
    .trim()
    .min(1, "Body is required")
    .max(
      FIELD_LIMITS.body,
      `Body must be at most ${FIELD_LIMITS.body} characters`,
    )
    .transform(sanitizePlainText),
  category: ticketCategorySchema.optional(),
  assignedToId: z.string().trim().optional(),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;
