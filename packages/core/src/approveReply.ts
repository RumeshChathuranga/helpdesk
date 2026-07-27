import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";
import { sanitizePlainText } from "./sanitizePlainText.js";

export const approveReplyBodySchema = z.object({
  /** Optional edited draft — agents may tweak the AI's text before sending. */
  body: z
    .string()
    .trim()
    .min(1, "Reply is required")
    .max(
      FIELD_LIMITS.body,
      `Reply must be at most ${FIELD_LIMITS.body} characters`,
    )
    .transform(sanitizePlainText)
    .optional(),
});

export type ApproveReplyBody = z.infer<typeof approveReplyBodySchema>;
