import { z } from "zod";

export const replyDirectionSchema = z.enum(["INBOUND", "OUTBOUND"]);

export const replyApprovalStateSchema = z.enum([
  "NOT_REQUIRED",
  "PENDING_APPROVAL",
  "APPROVED",
  "DISCARDED",
]);

export const emailDeliveryStateSchema = z.enum([
  "NOT_QUEUED",
  "QUEUED",
  "SENDING",
  "SENT",
  "FAILED",
]);

export type ReplyDirection = z.infer<typeof replyDirectionSchema>;
export type ReplyApprovalState = z.infer<typeof replyApprovalStateSchema>;
export type EmailDeliveryState = z.infer<typeof emailDeliveryStateSchema>;
