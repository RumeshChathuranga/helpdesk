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

const WEBHOOK_SECRET = "test-inbound-webhook-secret";

let server: Server;
let baseUrl: string;
const createdTicketIds: string[] = [];

beforeAll(() => {
  process.env.INBOUND_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const app = createApp();
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.reply.deleteMany({
      where: { ticketId: { in: [...createdTicketIds] } },
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  }
});

afterAll(() => {
  server.close();
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
    expect(ticket?.status).toBe("OPEN");
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
});
