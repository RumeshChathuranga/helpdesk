import type { InboundEmail } from "core";
import { inboundEmailSchema } from "core";
import type { ZodError } from "zod";
import { prisma } from "../prisma.js";
import { enqueueProcessTicket } from "../../jobs/processTicket.js";
import { AI_AGENT_EMAIL } from "../../config.js";

export type InboundEmailResult = {
  ticketId: string;
  created: "ticket" | "reply";
};

function firstZodIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function parseInboundEmail(
  input: unknown,
):
  | { success: true; data: InboundEmail }
  | { success: false; error: string } {
  const parsed = inboundEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: firstZodIssueMessage(parsed.error) };
  }
  return { success: true, data: parsed.data };
}

/** Finds the ticket a message-id belongs to, checking both the ticket's own
 *  id and every reply's id, since after the first reply the "most recent
 *  message in the thread" a mail client points at is a Reply row. */
async function findThreadTicketId(externalMessageId: string): Promise<string | undefined> {
  const existingTicket = await prisma.ticket.findUnique({
    where: { externalMessageId },
    select: { id: true },
  });
  if (existingTicket) return existingTicket.id;

  const existingReply = await prisma.reply.findFirst({
    where: { externalMessageId },
    select: { ticketId: true },
  });
  return existingReply?.ticketId;
}

export async function createFromInboundEmail(
  input: InboundEmail,
): Promise<InboundEmailResult> {
  const { fromEmail, fromName, subject, body, messageId, inReplyTo, references } = input;

  // Idempotency: a provider retry (webhook) or a re-poll of the same mailbox
  // (IMAP poller) must not fork a duplicate reply/ticket for a message we've
  // already ingested. Without a messageId there is no key to dedupe on.
  const alreadyIngested = messageId ? await findThreadTicketId(messageId) : undefined;
  if (alreadyIngested) {
    return { ticketId: alreadyIngested, created: "reply" };
  }

  // In-Reply-To is the primary signal; References (oldest → newest) is a
  // fallback for clients/relays that drop or mangle In-Reply-To but keep the
  // full chain — walk it newest-first so we land on the closest ancestor.
  const candidateIds = [
    ...(inReplyTo ? [inReplyTo] : []),
    ...(references ? [...references].reverse() : []),
  ];

  for (const candidateId of candidateIds) {
    const threadTicketId = await findThreadTicketId(candidateId);
    if (threadTicketId) {
      await prisma.reply.create({
        data: {
          ticketId: threadTicketId,
          body,
          direction: "INBOUND",
          externalMessageId: messageId,
        },
      });

      return { ticketId: threadTicketId, created: "reply" };
    }
  }

  const aiAgent = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL } });
  if (!aiAgent) {
    console.warn(
      `[inbound-email] AI agent user not found for email ${AI_AGENT_EMAIL} — new ticket will be created unassigned`,
    );
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      body,
      fromEmail,
      fromName,
      externalMessageId: messageId,
      status: "NEW",
      category: "OTHER",
      assignedToId: aiAgent?.id,
    },
    select: { id: true },
  });

  // Enqueue a persistent pg-boss job — classifies category + attempts KB auto-resolution.
  // If enqueueing itself fails, the ticket must not stay invisible in NEW —
  // fall back to OPEN so an agent can still pick it up manually.
  try {
    await enqueueProcessTicket({ ticketId: ticket.id, subject, body });
  } catch (err) {
    console.error(`Failed to enqueue process-ticket job for ${ticket.id}:`, err);
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "OPEN" },
    });
  }

  return { ticketId: ticket.id, created: "ticket" };
}
