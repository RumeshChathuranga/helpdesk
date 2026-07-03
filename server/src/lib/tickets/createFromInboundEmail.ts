import type { InboundEmail } from "core";
import { inboundEmailSchema } from "core";
import type { ZodError } from "zod";
import { prisma } from "../prisma.js";
import { enqueueClassifyTicket } from "../../jobs/classifyTicket.js";

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
    const existingTicket = await prisma.ticket.findUnique({
      where: { externalMessageId: inReplyTo },
      select: { id: true },
    });

    if (existingTicket) {
      await prisma.reply.create({
        data: {
          ticketId: existingTicket.id,
          body,
          externalMessageId: messageId,
        },
      });

      return { ticketId: existingTicket.id, created: "reply" };
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      body,
      fromEmail,
      fromName,
      externalMessageId: messageId,
      status: "OPEN",
      category: "OTHER",
    },
    select: { id: true },
  });

  // Enqueue a persistent pg-boss job — survives process restarts
  void enqueueClassifyTicket({ ticketId: ticket.id, subject, body });

  return { ticketId: ticket.id, created: "ticket" };
}
