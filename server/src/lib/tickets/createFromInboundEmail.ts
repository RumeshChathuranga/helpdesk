import type { InboundEmail } from "core";
import { inboundEmailSchema } from "core";
import type { ZodError } from "zod";
import { prisma } from "../prisma.js";
import { enqueueProcessTicket } from "../../jobs/processTicket.js";
import { AI_AGENT_EMAIL } from "../../config.js";
import { childLogger } from "../logger.js";
import { inferRequesterType } from "./inferRequesterType.js";

const log = childLogger("inbound-email");

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

/** Checks both the ticket's own id and every reply's id — after the first
 *  reply, a mail client's "most recent message" is a Reply row, not the ticket. */
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

  // Dedupe a webhook retry or IMAP re-poll against a message we've already ingested.
  const alreadyIngested = messageId ? await findThreadTicketId(messageId) : undefined;
  if (alreadyIngested) {
    return { ticketId: alreadyIngested, created: "reply" };
  }

  // In-Reply-To first; References is a fallback, walked newest-first.
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
    log.warn(
      { aiAgentEmail: AI_AGENT_EMAIL },
      "AI agent user not found — new ticket will be created unassigned",
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
      requesterType: inferRequesterType(fromEmail),
    },
    select: { id: true },
  });

  // If enqueueing fails, the ticket must not stay invisible in NEW.
  try {
    await enqueueProcessTicket({ ticketId: ticket.id, subject, body });
  } catch (err) {
    log.error({ ticketId: ticket.id, err }, "failed to enqueue process-ticket job");
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "OPEN" },
    });
  }

  return { ticketId: ticket.id, created: "ticket" };
}
