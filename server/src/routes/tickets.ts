import {
  approveReplyBodySchema,
  createReplyBodySchema,
  createTicketBodySchema,
  DEFAULT_TICKET_LIST_SORT,
  FIELD_LIMITS,
  listTicketsQuerySchema,
  sanitizePlainText,
  ticketListSortToOrderBy,
  updateTicketBodySchema,
  type ListTicketsQuery,
  type TicketStatus,
  AGENT_VISIBLE_STATUSES,
} from "core";
import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAgent } from "../middleware/requireAgent.js";
import { generateText } from "ai";
import { getAiModel, AI_TOKEN_MISSING_MESSAGE } from "../lib/aiClient.js";
import { enqueueProcessTicket } from "../jobs/processTicket.js";
import { enqueueSendEmail } from "../jobs/sendEmail.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { AI_AGENT_EMAIL, SUPPORT_EMAIL } from "../config.js";
import { PROMPT_TAG } from "../lib/ai/promptTags.js";
import { childLogger } from "../lib/logger.js";
import { withAiErrorMetric } from "../lib/metrics.js";

const log = childLogger("tickets");

function parseRouteId(
  id: string | string[] | undefined,
): string | undefined {
  if (typeof id === "string") {
    return id;
  }
  return id?.[0];
}

async function requireTicketIdOrRespond(
  res: Response,
  rawId: string | string[] | undefined,
): Promise<string | null> {
  const id = parseRouteId(rawId);
  if (!id) {
    res.status(400).json({ error: "Invalid ticket id" });
    return null;
  }

  const existing = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return null;
  }

  return id;
}

export const ticketsRouter: IRouter = Router();

const ticketListSelect = {
  id: true,
  subject: true,
  status: true,
  category: true,
  fromEmail: true,
  fromName: true,
  requesterType: true,
  assignedToId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const replySelect = {
  id: true,
  body: true,
  isAi: true,
  sentEmail: true,
  externalMessageId: true,
  createdAt: true,
  direction: true,
  approval: true,
  deliveryState: true,
  sentAt: true,
  deliveryError: true,
} as const;

function buildTicketSearchWhere(search: string): Prisma.TicketWhereInput {
  return {
    OR: [
      { subject: { contains: search, mode: "insensitive" } },
      { body: { contains: search, mode: "insensitive" } },
      { fromEmail: { contains: search, mode: "insensitive" } },
      { fromName: { contains: search, mode: "insensitive" } },
    ],
  };
}

ticketsRouter.get("/", requireAgent, validateQuery(listTicketsQuerySchema), async (req, res) => {
  const { status, category, requesterType, sort, search, page, pageSize } =
    req.query as unknown as ListTicketsQuery;
  const orderBy = ticketListSortToOrderBy(sort ?? DEFAULT_TICKET_LIST_SORT);

  // Silently ignore requests for hidden statuses (NEW/PROCESSING are AI-internal states).
  // If a specific agent-visible status is requested, apply it; otherwise exclude hidden ones.
  const agentVisibleStatus =
    status && (AGENT_VISIBLE_STATUSES as readonly TicketStatus[]).includes(status)
      ? status
      : undefined;

  const where: Prisma.TicketWhereInput = {
    status: agentVisibleStatus ?? { notIn: ["NEW", "PROCESSING"] },
    ...(category ? { category } : {}),
    ...(requesterType ? { requesterType } : {}),
    ...(search ? buildTicketSearchWhere(search) : {}),
  };

  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ticketListSelect,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page, pageSize });
});

ticketsRouter.get("/stats", requireAgent, async (req, res) => {
  const result = await prisma.$queryRaw<[{ get_dashboard_stats: unknown }]>`
    SELECT get_dashboard_stats();
  `;
  const stats = result[0]?.get_dashboard_stats;
  if (!stats) {
    res.status(500).json({ error: "Failed to load dashboard statistics" });
    return;
  }
  res.json(stats);
});

// Unlike GET /, this intentionally does NOT filter out NEW/PROCESSING —
// agents may land on a ticket via direct link while it's still being AI-processed;
// the client renders those as read-only (see the EditTicketForm gating in
// TicketDetailPage).
ticketsRouter.get("/:id", requireAgent, async (req, res) => {
  const id = parseRouteId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      ...ticketListSelect,
      body: true,
      externalMessageId: true,
      aiSummary: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        select: replySelect,
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ ticket });
});

ticketsRouter.post("/:id/replies", requireAgent, validateBody(createReplyBodySchema), async (req, res) => {
  const ticketId = await requireTicketIdOrRespond(res, req.params.id);
  if (!ticketId) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { fromEmail: true },
  });

  const shouldSend = req.body.sendEmail ?? Boolean(ticket?.fromEmail);
  if (shouldSend && !ticket?.fromEmail) {
    res.status(400).json({ error: "This ticket has no requester email address" });
    return;
  }

  const reply = await prisma.reply.create({
    data: {
      ticketId,
      body: req.body.body,
      direction: "OUTBOUND",
      approval: "NOT_REQUIRED",
      deliveryState: shouldSend ? "QUEUED" : "NOT_QUEUED",
    },
    select: replySelect,
  });

  if (!shouldSend) {
    res.status(201).json({ reply });
    return;
  }

  try {
    await enqueueSendEmail({ replyId: reply.id });
  } catch (err) {
    // Same posture as ticket creation: never lose the reply because the
    // queue is down — record it as failed so the agent can retry.
    log.error({ replyId: reply.id, err }, "failed to enqueue send-email job");
    const updated = await prisma.reply.update({
      where: { id: reply.id },
      data: {
        deliveryState: "FAILED",
        deliveryError: "Could not queue the email for sending",
      },
      select: replySelect,
    });
    res.status(201).json({ reply: updated });
    return;
  }

  res.status(201).json({ reply });
});

async function loadReplyForModeration(
  res: Response,
  ticketId: string,
  replyId: string,
): Promise<{
  reply: { id: string; approval: string; deliveryState: string };
  ticket: { fromEmail: string | null };
} | null> {
  const reply = await prisma.reply.findUnique({
    where: { id: replyId },
    select: {
      id: true,
      approval: true,
      deliveryState: true,
      ticket: { select: { id: true, fromEmail: true } },
    },
  });

  if (!reply || reply.ticket.id !== ticketId) {
    res.status(404).json({ error: "Reply not found" });
    return null;
  }

  return { reply, ticket: reply.ticket };
}

ticketsRouter.post(
  "/:id/replies/:replyId/approve",
  requireAgent,
  validateBody(approveReplyBodySchema),
  async (req, res) => {
    const ticketId = parseRouteId(req.params.id);
    const replyId = parseRouteId(req.params.replyId);
    if (!ticketId || !replyId) {
      res.status(400).json({ error: "Invalid ticket or reply id" });
      return;
    }

    const loaded = await loadReplyForModeration(res, ticketId, replyId);
    if (!loaded) return;
    const { reply, ticket } = loaded;

    if (reply.approval !== "PENDING_APPROVAL") {
      res.status(409).json({ error: "This reply is not awaiting approval" });
      return;
    }
    if (!ticket.fromEmail) {
      res.status(400).json({ error: "This ticket has no requester email address" });
      return;
    }

    const updated = await prisma.reply.update({
      where: { id: replyId },
      data: {
        ...(req.body.body ? { body: req.body.body } : {}),
        approval: "APPROVED",
        approvedById: res.locals.agentSession!.user.id,
        deliveryState: "QUEUED",
        deliveryError: null,
      },
      select: replySelect,
    });

    try {
      await enqueueSendEmail({ replyId });
    } catch (err) {
      log.error({ replyId, err }, "failed to enqueue send-email job");
      const failed = await prisma.reply.update({
        where: { id: replyId },
        data: {
          deliveryState: "FAILED",
          deliveryError: "Could not queue the email for sending",
        },
        select: replySelect,
      });
      res.json({ reply: failed });
      return;
    }

    res.json({ reply: updated });
  },
);

ticketsRouter.post("/:id/replies/:replyId/discard", requireAgent, async (req, res) => {
  const ticketId = parseRouteId(req.params.id);
  const replyId = parseRouteId(req.params.replyId);
  if (!ticketId || !replyId) {
    res.status(400).json({ error: "Invalid ticket or reply id" });
    return;
  }

  const loaded = await loadReplyForModeration(res, ticketId, replyId);
  if (!loaded) return;
  const { reply } = loaded;

  if (reply.approval !== "PENDING_APPROVAL") {
    res.status(409).json({ error: "This reply is not awaiting approval" });
    return;
  }

  const updated = await prisma.reply.update({
    where: { id: replyId },
    data: { approval: "DISCARDED", deliveryState: "NOT_QUEUED" },
    select: replySelect,
  });

  res.json({ reply: updated });
});

ticketsRouter.post("/:id/replies/:replyId/retry-send", requireAgent, async (req, res) => {
  const ticketId = parseRouteId(req.params.id);
  const replyId = parseRouteId(req.params.replyId);
  if (!ticketId || !replyId) {
    res.status(400).json({ error: "Invalid ticket or reply id" });
    return;
  }

  const loaded = await loadReplyForModeration(res, ticketId, replyId);
  if (!loaded) return;
  const { reply, ticket } = loaded;

  if (reply.deliveryState !== "FAILED") {
    res.status(409).json({ error: "This reply has not failed to send" });
    return;
  }
  if (!ticket.fromEmail) {
    res.status(400).json({ error: "This ticket has no requester email address" });
    return;
  }

  const updated = await prisma.reply.update({
    where: { id: replyId },
    data: { deliveryState: "QUEUED", deliveryError: null },
    select: replySelect,
  });

  try {
    await enqueueSendEmail({ replyId });
  } catch (err) {
    log.error({ replyId, err }, "failed to enqueue send-email job");
    const failed = await prisma.reply.update({
      where: { id: replyId },
      data: {
        deliveryState: "FAILED",
        deliveryError: "Could not queue the email for sending",
      },
      select: replySelect,
    });
    res.json({ reply: failed });
    return;
  }

  res.json({ reply: updated });
});

const polishReplyBodySchema = z.object({
  draft: z
    .string({ error: "draft must be a non-empty string" })
    .trim()
    .min(1, "draft must be a non-empty string")
    .max(
      FIELD_LIMITS.body,
      `Draft must be at most ${FIELD_LIMITS.body} characters`,
    ),
});

ticketsRouter.post("/:id/polish-reply", requireAgent, validateBody(polishReplyBodySchema), async (req, res) => {
  const ticketId = await requireTicketIdOrRespond(res, req.params.id);
  if (!ticketId) return;

  const { draft } = req.body;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { subject: true, body: true, fromName: true, fromEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const model = getAiModel();
  if (!model) {
    res.status(500).json({ error: AI_TOKEN_MISSING_MESSAGE });
    return;
  }

  const session = res.locals.agentSession!;
  const agentName = session.user.name ?? "CITeS IT Help Desk";
  const agentEmail = SUPPORT_EMAIL;

  // Determine requester name for personalised greeting
  const requesterName = ticket.fromName?.trim()
    ? ticket.fromName.trim().split(" ")[0] // first name only
    : "there";

  const { text } = await withAiErrorMetric("polish", () =>
    generateText({
      model,
      system: `You are a professional ${PROMPT_TAG.polish}. Your job is to polish and improve agent reply drafts while keeping the same intent and tone.
Guidelines:
- Fix grammar, spelling, and punctuation errors
- Make the language clearer and more professional
- Keep the same meaning and core content
- Maintain a helpful, empathetic tone
- Do not add new information or promises not in the original draft
- Do not invent university procedures, URLs, or contact details that are not in the agent's draft
- Always open the reply with: "Dear ${requesterName},"
- Always close the reply with exactly this sign-off (on its own lines):

Best regards,
${agentName}
${agentEmail}

- Return ONLY the polished reply text (greeting + body + sign-off), no explanations or meta-commentary`,
      prompt: `Ticket subject: ${ticket.subject}

Original ticket message:
${ticket.body}

Agent's draft reply to polish:
${draft}`,
    }),
  );

  res.json({ polished: text });
});


ticketsRouter.post("/:id/summarize", requireAgent, async (req, res) => {
  const ticketId = await requireTicketIdOrRespond(res, req.params.id);
  if (!ticketId) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      subject: true,
      body: true,
      fromName: true,
      fromEmail: true,
      replies: {
        orderBy: { createdAt: "asc" },
        select: { body: true, isAi: true, createdAt: true },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const model = getAiModel();
  if (!model) {
    res.status(500).json({ error: AI_TOKEN_MISSING_MESSAGE });
    return;
  }

  const conversationHistory = ticket.replies
    .map((r, i) => {
      const role = r.isAi ? "Agent (AI)" : "Agent";
      return `Reply ${i + 1} [${role}]:\n${r.body}`;
    })
    .join("\n\n");

  const prompt = `Ticket subject: ${ticket.subject}

Requester (${ticket.fromName ?? ticket.fromEmail ?? "Unknown"}) original message:
${ticket.body}

${conversationHistory ? `Conversation history:\n${conversationHistory}` : "No replies yet."}`;

  const { text } = await withAiErrorMetric("summarize", () =>
    generateText({
      model,
      system: `You are a concise ${PROMPT_TAG.summarize}. Summarize the support ticket and its conversation history in 3-5 bullet points. Focus on:
- The requester's core issue or request
- Key actions taken or proposed by the help desk
- Current status or outstanding next steps
Be concise and factual. Use plain text bullet points starting with "•".`,
      prompt,
    }),
  );

  const summary = sanitizePlainText(text);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { aiSummary: summary },
  });

  res.json({ summary });
});

ticketsRouter.post("/", requireAgent, validateBody(createTicketBodySchema), async (req, res) => {
  const session = res.locals.agentSession;
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { subject, body, category, assignedToId } = req.body;

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, deletedAt: null },
      select: { id: true },
    });
    if (!assignee) {
      res.status(400).json({ error: "Assigned user not found" });
      return;
    }
  }

  let finalAssignedToId = assignedToId;
  if (!finalAssignedToId) {
    const aiAgent = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL } });
    if (aiAgent) {
      finalAssignedToId = aiAgent.id;
    } else {
      log.warn(
        { aiAgentEmail: AI_AGENT_EMAIL },
        "AI agent user not found — new ticket will be created unassigned",
      );
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      body,
      category: category ?? "OTHER",
      assignedToId: finalAssignedToId,
      createdById: session.user.id,
      status: "NEW",
    },
    select: {
      ...ticketListSelect,
      body: true,
    },
  });

  // Always run the full process-ticket job (classification + KB resolution).
  // If enqueueing itself fails, the ticket must not stay invisible in NEW —
  // fall back to OPEN so an agent can still pick it up manually.
  try {
    await enqueueProcessTicket({ ticketId: ticket.id, subject, body });
  } catch (err) {
    log.error({ ticketId: ticket.id, err }, "failed to enqueue process-ticket job");
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "OPEN" },
    });
    ticket.status = "OPEN";
  }

  res.status(201).json({ ticket });
});

ticketsRouter.patch("/:id", requireAgent, validateBody(updateTicketBodySchema), async (req, res) => {
  const id = parseRouteId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }

  const existing = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { status, category, assignedToId, requesterType } = req.body;

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, deletedAt: null },
      select: { id: true },
    });
    if (!assignee) {
      res.status(400).json({ error: "Assigned user not found" });
      return;
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(assignedToId !== undefined ? { assignedToId } : {}),
      ...(requesterType !== undefined ? { requesterType } : {}),
    },
    select: {
      ...ticketListSelect,
      body: true,
    },
  });

  res.json({ ticket });
});

ticketsRouter.delete("/:id", requireAgent, async (req, res) => {
  const id = parseRouteId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }

  const existing = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  await prisma.ticket.delete({ where: { id } });
  res.status(204).send();
});
