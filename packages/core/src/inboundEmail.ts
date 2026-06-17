import { z } from "zod";

export const inboundEmailSchema = z.object({
  fromEmail: z.string().email("Enter a valid email"),
  fromName: z.string().trim().optional(),
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Body is required"),
  messageId: z.string().trim().optional(),
  inReplyTo: z.string().trim().optional(),
});

export type InboundEmail = z.infer<typeof inboundEmailSchema>;
