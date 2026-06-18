import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";
import { sanitizePlainText } from "./sanitizePlainText.js";

export const inboundEmailSchema = z.object({
  fromEmail: z
    .string()
    .email("Enter a valid email")
    .max(
      FIELD_LIMITS.email,
      `Email must be at most ${FIELD_LIMITS.email} characters`,
    ),
  fromName: z
    .string()
    .trim()
    .max(
      FIELD_LIMITS.fromName,
      `Name must be at most ${FIELD_LIMITS.fromName} characters`,
    )
    .transform(sanitizePlainText)
    .optional(),
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
  messageId: z
    .string()
    .trim()
    .max(
      FIELD_LIMITS.messageId,
      `Message ID must be at most ${FIELD_LIMITS.messageId} characters`,
    )
    .optional(),
  inReplyTo: z
    .string()
    .trim()
    .max(
      FIELD_LIMITS.messageId,
      `In-reply-to must be at most ${FIELD_LIMITS.messageId} characters`,
    )
    .optional(),
});

export type InboundEmail = z.infer<typeof inboundEmailSchema>;
