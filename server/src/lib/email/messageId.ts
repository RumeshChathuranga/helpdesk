import { EMAIL_MESSAGE_ID_DOMAIN } from "../../config.js";

/**
 * Deterministic per-reply Message-ID, written to the DB before the send so
 * threading survives a lost SMTP response and a retry reuses the same id
 * instead of forking the thread.
 */
export function buildOutboundMessageId(
  replyId: string,
  domain: string = EMAIL_MESSAGE_ID_DOMAIN,
): string {
  return `<reply.${replyId}@${domain}>`;
}
