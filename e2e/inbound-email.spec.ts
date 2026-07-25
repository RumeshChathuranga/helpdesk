import { test, expect } from "@playwright/test";
import { API_BASE_URL, loginAgentViaApi } from "./helpers/auth";
import {
  postInboundEmail,
  uniqueMessageId,
  type InboundEmailResponse,
} from "./helpers/inboundEmail";
import { waitForTicketAgentVisible } from "./helpers/tickets";

test.describe("Inbound email webhook", () => {
  const createdTicketIds: string[] = [];

  test.afterEach(async ({ request }) => {
    if (createdTicketIds.length === 0) return;
    await loginAgentViaApi(request);
    const ids = createdTicketIds.splice(0);
    for (const id of ids) {
      await request.delete(`${API_BASE_URL}/api/tickets/${id}`).catch(() => {});
    }
  });

  test("returns 401 without a valid bearer token", async ({ request }) => {
    const response = await postInboundEmail(
      request,
      {
        fromEmail: "student@example.com",
        subject: "Help",
        body: "I need help",
      },
      "wrong-secret",
    );

    expect(response.status()).toBe(401);
  });

  test("creates a ticket from a normalized inbound email payload", async ({
    request,
  }) => {
    const messageId = uniqueMessageId("create");
    const subject = `E2E inbound ${Date.now()}`;

    const response = await postInboundEmail(request, {
      fromEmail: "student@example.com",
      fromName: "Alex",
      subject,
      body: "I need a refund for course X",
      messageId,
    });

    expect(response.ok()).toBeTruthy();
    const json = (await response.json()) as InboundEmailResponse;
    expect(json.created).toBe("ticket");
    expect(json.ticketId).toBeTruthy();
    createdTicketIds.push(json.ticketId);
  });

  test("agent can view a webhook-created ticket via the tickets API", async ({
    request,
  }) => {
    const messageId = uniqueMessageId("visible");
    const subject = `E2E visible ticket ${Date.now()}`;

    const webhookRes = await postInboundEmail(request, {
      fromEmail: "student@example.com",
      fromName: "Alex",
      subject,
      body: "Please help with my account",
      messageId,
    });
    expect(webhookRes.ok()).toBeTruthy();
    const { ticketId } = (await webhookRes.json()) as InboundEmailResponse;
    createdTicketIds.push(ticketId);

    await loginAgentViaApi(request);
    // Hidden from the list while NEW/PROCESSING — wait for the worker first.
    await waitForTicketAgentVisible(request, ticketId, {
      baseUrl: API_BASE_URL,
    });

    const listRes = await request.get(`${API_BASE_URL}/api/tickets`);
    expect(listRes.ok()).toBeTruthy();
    const { tickets } = (await listRes.json()) as {
      tickets: Array<{
        id: string;
        subject: string;
        fromEmail: string | null;
        fromName: string | null;
      }>;
    };

    const ticket = tickets.find((t) => t.id === ticketId);
    expect(ticket).toBeDefined();
    expect(ticket?.subject).toBe(subject);
    expect(ticket?.fromEmail).toBe("student@example.com");
    expect(ticket?.fromName).toBe("Alex");

    const detailRes = await request.get(`${API_BASE_URL}/api/tickets/${ticketId}`);
    expect(detailRes.ok()).toBeTruthy();
    const { ticket: detail } = (await detailRes.json()) as {
      ticket: {
        body: string;
        externalMessageId: string | null;
        status: string;
        category: string;
      };
    };
    expect(detail.body).toBe("Please help with my account");
    expect(detail.externalMessageId).toBe(messageId);
    expect(detail.status).toBe("OPEN");
    expect(detail.category).toBe("OTHER");
  });

  test("appends a reply when inReplyTo matches an existing ticket message id", async ({
    request,
  }) => {
    const messageId = uniqueMessageId("thread");
    const subject = `E2E thread ${Date.now()}`;

    const createRes = await postInboundEmail(request, {
      fromEmail: "student@example.com",
      subject,
      body: "Original message",
      messageId,
    });
    expect(createRes.ok()).toBeTruthy();
    const { ticketId } = (await createRes.json()) as InboundEmailResponse;
    createdTicketIds.push(ticketId);

    const replyRes = await postInboundEmail(request, {
      fromEmail: "student@example.com",
      subject: `Re: ${subject}`,
      body: "Following up on my refund",
      messageId: uniqueMessageId("reply"),
      inReplyTo: messageId,
    });
    expect(replyRes.ok()).toBeTruthy();
    const replyJson = (await replyRes.json()) as InboundEmailResponse;
    expect(replyJson.created).toBe("reply");
    expect(replyJson.ticketId).toBe(ticketId);

    await loginAgentViaApi(request);

    const detailRes = await request.get(`${API_BASE_URL}/api/tickets/${ticketId}`);
    expect(detailRes.ok()).toBeTruthy();
    const { ticket } = (await detailRes.json()) as {
      ticket: { replies: Array<{ body: string }> };
    };
    expect(ticket.replies).toHaveLength(1);
    expect(ticket.replies[0]?.body).toBe("Following up on my refund");
  });
});
