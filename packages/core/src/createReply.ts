import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";
import { sanitizePlainText } from "./sanitizePlainText.js";

export const createReplyBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply is required")
    .max(
      FIELD_LIMITS.body,
      `Reply must be at most ${FIELD_LIMITS.body} characters`,
    )
    .transform(sanitizePlainText),
});

export type CreateReplyBody = z.infer<typeof createReplyBodySchema>;
