import { afterEach, describe, expect, it } from "bun:test";
import { prisma } from "../lib/prisma.js";
import { setEmailDriverForTesting } from "../lib/email/index.js";
import type { EmailDriver, EmailMessage, SendResult } from "../lib/email/index.js";
import { buildOutboundMessageId } from "../lib/email/messageId.js";
import { runSendEmail } from "./sendEmail.js";

function createStubDriver(impl?: (message: EmailMessage) => SendResult) {
  const calls: EmailMessage[] = [];
  const driver: EmailDriver = {
    name: "log",
    async send(message) {
      calls.push(message);
      return impl ? impl(message) : { ok: true, messageId: message.messageId, accepted: [message.to] };
    },
  };
  return { driver, calls };
}

describe("runSendEmail", () => {
  const createdTicketIds: string[] = [];

  afterEach(async () => {
    setEmailDriverForTesting(undefined);
    if (createdTicketIds.length > 0) {
      await prisma.reply.deleteMany({ where: { ticketId: { in: [...createdTicketIds] } } });
      await prisma.ticket.deleteMany({ where: { id: { in: [...createdTicketIds] } } });
      createdTicketIds.length = 0;
    }
  });

  async function createTicketWithReply(opts: {
    fromEmail?: string | null;
    isAi?: boolean;
    approval?: "NOT_REQUIRED" | "PENDING_APPROVAL" | "APPROVED" | "DISCARDED";
    deliveryState?: "NOT_QUEUED" | "QUEUED" | "SENDING" | "SENT" | "FAILED";
    status?: "NEW" | "PROCESSING" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  }) {
    const ticket = await prisma.ticket.create({
      data: {
        subject: "Test subject",
        body: "Test body",
        fromEmail: opts.fromEmail === undefined ? "customer@example.com" : opts.fromEmail,
        status: opts.status ?? "OPEN",
      },
    });
    createdTicketIds.push(ticket.id);

    const reply = await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        body: "Reply body",
        isAi: opts.isAi ?? false,
        direction: "OUTBOUND",
        approval: opts.approval ?? "NOT_REQUIRED",
        deliveryState: opts.deliveryState ?? "QUEUED",
      },
    });

    return { ticket, reply };
  }

  it("sends the email and records SENT on the happy path", async () => {
    const { driver, calls } = createStubDriver();
    setEmailDriverForTesting(driver);

    const { ticket, reply } = await createTicketWithReply({});

    await runSendEmail(reply.id);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.to).toBe("customer@example.com");

    const updated = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updated.deliveryState).toBe("SENT");
    expect(updated.sentEmail).toBe(true);
    expect(updated.sentAt).not.toBeNull();
    expect(updated.externalMessageId).toBe(buildOutboundMessageId(reply.id));

    const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketAfter.status).toBe("OPEN"); // non-AI reply: ticket status untouched
  });

  it("is idempotent — calling it twice sends exactly once", async () => {
    const { driver, calls } = createStubDriver();
    setEmailDriverForTesting(driver);

    const { reply } = await createTicketWithReply({});

    await runSendEmail(reply.id);
    await runSendEmail(reply.id);

    expect(calls).toHaveLength(1);

    const updated = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updated.sendAttempts).toBe(1);
    expect(updated.deliveryState).toBe("SENT");
  });

  it("resolves the ticket when an approved AI reply is sent successfully", async () => {
    setEmailDriverForTesting(createStubDriver().driver);

    const { ticket, reply } = await createTicketWithReply({
      isAi: true,
      approval: "APPROVED",
      status: "OPEN",
    });

    await runSendEmail(reply.id);

    const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketAfter.status).toBe("RESOLVED");
  });

  it("does not touch ticket status for a non-AI reply", async () => {
    setEmailDriverForTesting(createStubDriver().driver);

    const { ticket, reply } = await createTicketWithReply({ status: "OPEN" });

    await runSendEmail(reply.id);

    const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketAfter.status).toBe("OPEN");
  });

  it("records FAILED and does not throw on a permanent failure", async () => {
    const { driver } = createStubDriver(() => ({
      ok: false,
      permanent: true,
      error: "invalid recipient",
    }));
    setEmailDriverForTesting(driver);

    const { reply } = await createTicketWithReply({});

    await runSendEmail(reply.id); // must not throw

    const updated = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updated.deliveryState).toBe("FAILED");
    expect(updated.deliveryError).toBe("invalid recipient");
    expect(updated.sentEmail).toBe(false);
  });

  it("records FAILED and throws on a transient failure so pg-boss retries", async () => {
    const { driver } = createStubDriver(() => ({
      ok: false,
      permanent: false,
      error: "connection timed out",
    }));
    setEmailDriverForTesting(driver);

    const { reply } = await createTicketWithReply({});

    await expect(runSendEmail(reply.id)).rejects.toThrow(/connection timed out/);

    const updated = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updated.deliveryState).toBe("FAILED");
  });

  it("never calls the driver for a reply still awaiting approval", async () => {
    // deliveryState QUEUED here is not a state the route/worker ever produces
    // for a PENDING_APPROVAL reply — this exercises the guard in step 2 as a
    // defense-in-depth check, independent of the step-1 claim filter.
    const { driver, calls } = createStubDriver();
    setEmailDriverForTesting(driver);

    const { reply } = await createTicketWithReply({
      isAi: true,
      approval: "PENDING_APPROVAL",
      deliveryState: "QUEUED",
    });

    await runSendEmail(reply.id);

    expect(calls).toHaveLength(0);
    const updated = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updated.deliveryState).toBe("NOT_QUEUED");
  });

  it("does not send when the ticket has no fromEmail", async () => {
    const { driver, calls } = createStubDriver();
    setEmailDriverForTesting(driver);

    const { reply } = await createTicketWithReply({ fromEmail: null });

    await runSendEmail(reply.id);

    expect(calls).toHaveLength(0);
    const updated = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(updated.deliveryState).toBe("NOT_QUEUED");
  });
});
