import { type APIRequestContext } from "@playwright/test";
import { API_BASE_URL } from "./auth";

export const INBOUND_WEBHOOK_SECRET =
  process.env.INBOUND_WEBHOOK_SECRET ?? "test-inbound-webhook-secret";

export function uniqueMessageId(prefix = "e2e"): string {
  return `<${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@mail>`;
}

export type InboundEmailPayload = {
  fromEmail: string;
  fromName?: string;
  subject: string;
  body: string;
  messageId?: string;
  inReplyTo?: string;
};

export type InboundEmailResponse = {
  ticketId: string;
  created: "ticket" | "reply";
};

export async function postInboundEmail(
  request: APIRequestContext,
  body: InboundEmailPayload,
  secret = INBOUND_WEBHOOK_SECRET,
) {
  return request.post(`${API_BASE_URL}/api/webhooks/inbound-email`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    data: body,
  });
}
