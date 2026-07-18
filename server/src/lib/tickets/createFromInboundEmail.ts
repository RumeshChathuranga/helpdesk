import type { InboundEmail } from "core";
import { inboundEmailSchema } from "core";
import type { ZodError } from "zod";
import { prisma } from "../prisma.js";
import { enqueueProcessTicket } from "../../jobs/processTicket.js";

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

export async function createFromInboundEmail(
  input: InboundEmail,
): Promise<InboundEmailResult> {
  const { fromEmail, fromName, subject, body, messageId, inReplyTo } = input;

  if (inReplyTo) {
    // Real mail clients set In-Reply-To to the most recent message in the
    // thread. After the first reply that's a Reply row, not the Ticket row —
    // so check both, falling back to the reply's parent ticket.
    const existingTicket = await prisma.ticket.findUnique({
      where: { externalMessageId: inReplyTo },
      select: { id: true },
    });

    const threadTicketId =
      existingTicket?.id ??
      (
        await prisma.reply.findFirst({
          where: { externalMessageId: inReplyTo },
          select: { ticketId: true },
        })
      )?.ticketId;

    if (threadTicketId) {
      await prisma.reply.create({
        data: {
          ticketId: threadTicketId,
          body,
          externalMessageId: messageId,
        },
      });

      return { ticketId: threadTicketId, created: "reply" };
    }
  }

  const aiAgent = await prisma.user.findUnique({ where: { email: "ai@example.com" } });

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
