import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

import { startBoss, boss } from "../../lib/boss.js";

// Must be at least 32 chars — shorter secrets are treated as unconfigured
// by verifyInboundWebhookSecret and answer 503.
const WEBHOOK_SECRET = "test-inbound-webhook-secret-32chars";

let server: Server;
let baseUrl: string;
let bossStarted = false;
const createdTicketIds: string[] = [];

beforeAll(async () => {
  process.env.INBOUND_WEBHOOK_SECRET = WEBHOOK_SECRET;

  await startBoss();
  bossStarted = true;
  await boss.createQueue("process-ticket");

  const app = createApp();
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  const validIds = createdTicketIds.filter(Boolean);
  if (validIds.length > 0) {
    await prisma.reply.deleteMany({
      where: { ticketId: { in: validIds } },
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: validIds } },
    });
  }
  createdTicketIds.length = 0;
});

afterAll(async () => {
  // Guard both steps individually: if beforeAll threw partway through (e.g.
  // startBoss() failed), `server`/`bossStarted` may never have been set, and
  // we don't want teardown to throw a second, unrelated error on top of the
  // real setup failure.
  server?.close();
  if (bossStarted) {
    await boss.stop();
  }
});

async function postInboundEmail(
  body: Record<string, unknown>,
  secret = WEBHOOK_SECRET,
) {
  return fetch(`${baseUrl}/api/webhooks/inbound-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/inbound-email", () => {
  it("returns 401 without a valid bearer token", async () => {
    const res = await postInboundEmail(
      {
        fromEmail: "student@example.com",
        subject: "Help",
        body: "I need help",
      },
      "wrong-secret",
    );

    expect(res.status).toBe(401);
  });

  it("returns 503 when the configured secret is too short to be safe", async () => {
    process.env.INBOUND_WEBHOOK_SECRET = "too-short";
    try {
      const res = await postInboundEmail(
        {
          fromEmail: "student@example.com",
          subject: "Help",
          body: "I need help",
        },
        "too-short",
      );

      expect(res.status).toBe(503);
    } finally {
      process.env.INBOUND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    }
  });

  it("creates a ticket from a normalized inbound email payload", async () => {
    const messageId = `<test-${crypto.randomUUID()}@mail>`;

    const res = await postInboundEmail({
      fromEmail: "student@example.com",
      fromName: "Alex",
      subject: "Refund question",
      body: "I need a refund for course X",
      messageId,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ticketId: string; created: string };
    expect(json.created).toBe("ticket");
    createdTicketIds.push(json.ticketId);

    const ticket = await prisma.ticket.findUnique({
      where: { id: json.ticketId },
    });

    expect(ticket).not.toBeNull();
    expect(ticket?.fromEmail).toBe("student@example.com");
    expect(ticket?.fromName).toBe("Alex");
    expect(ticket?.subject).toBe("Refund question");
    expect(ticket?.body).toBe("I need a refund for course X");
    expect(ticket?.externalMessageId).toBe(messageId);
    expect(ticket?.status).toBe("NEW");
    expect(ticket?.category).toBe("OTHER");
  });

  it("appends a reply when inReplyTo matches an existing ticket message id", async () => {
    const messageId = `<thread-${crypto.randomUUID()}@mail>`;

    const createRes = await postInboundEmail({
      fromEmail: "student@example.com",
      subject: "Refund question",
      body: "Original message",
      messageId,
    });
    const { ticketId } = (await createRes.json()) as { ticketId: string };
    createdTicketIds.push(ticketId);

    const replyRes = await postInboundEmail({
      fromEmail: "student@example.com",
      subject: "Re: Refund question",
      body: "Following up on my refund",
      messageId: `<reply-${crypto.randomUUID()}@mail>`,
      inReplyTo: messageId,
    });

    expect(replyRes.status).toBe(200);
    const replyJson = (await replyRes.json()) as {
      ticketId: string;
      created: string;
    };
    expect(replyJson.created).toBe("reply");
    expect(replyJson.ticketId).toBe(ticketId);

    const replyTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    // The reply must be appended to the original ticket, not a new one
    expect(replyTicket).not.toBeNull();

    const replies = await prisma.reply.findMany({
      where: { ticketId },
    });
    expect(replies).toHaveLength(1);
    expect(replies[0]?.body).toBe("Following up on my refund");
  });

  it("appends a reply-to-a-reply to the original ticket, not the first reply's message id", async () => {
    const originalMessageId = `<thread-${crypto.randomUUID()}@mail>`;

    const createRes = await postInboundEmail({
      fromEmail: "student@example.com",
      subject: "Refund question",
      body: "Original message",
      messageId: originalMessageId,
    });
    const { ticketId } = (await createRes.json()) as { ticketId: string };
    createdTicketIds.push(ticketId);

    // First customer reply — In-Reply-To points at the original ticket message id.
    const secondMessageId = `<reply-1-${crypto.randomUUID()}@mail>`;
    const firstReplyRes = await postInboundEmail({
      fromEmail: "student@example.com",
      subject: "Re: Refund question",
      body: "Following up on my refund",
      messageId: secondMessageId,
      inReplyTo: originalMessageId,
    });
    expect(firstReplyRes.status).toBe(200);

    // Second customer reply — real mail clients set In-Reply-To to the most
    // recent message in the thread, i.e. the first reply's message id, not
    // the original ticket's. This must still land on the original ticket.
    const thirdMessageId = `<reply-2-${crypto.randomUUID()}@mail>`;
    const secondReplyRes = await postInboundEmail({
      fromEmail: "student@example.com",
      subject: "Re: Refund question",
      body: "Still waiting on this",
      messageId: thirdMessageId,
      inReplyTo: secondMessageId,
    });

    expect(secondReplyRes.status).toBe(200);
    const secondReplyJson = (await secondReplyRes.json()) as {
      ticketId: string;
      created: string;
    };
    expect(secondReplyJson.created).toBe("reply");
    expect(secondReplyJson.ticketId).toBe(ticketId);

    const replies = await prisma.reply.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });
    expect(replies).toHaveLength(2);
    expect(replies[1]?.body).toBe("Still waiting on this");
  });
});
