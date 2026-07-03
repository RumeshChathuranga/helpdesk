import {
  createReplyBodySchema,
  createTicketBodySchema,
  DEFAULT_TICKET_LIST_SORT,
  DEFAULT_TICKET_PAGE_SIZE,
  listTicketsQuerySchema,
  ticketListSortToOrderBy,
  updateTicketBodySchema,
  type TicketStatus,
  AGENT_VISIBLE_STATUSES,
} from "core";
import { Router, type IRouter, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAgent } from "../middleware/requireAgent.js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { enqueueProcessTicket } from "../jobs/processTicket.js";
import { validateBody, validateQuery } from "../middleware/validate.js";

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
  priority: true,
  fromEmail: true,
  fromName: true,
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
  const { status, category, sort, search, page, pageSize } = req.query;
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
  const result = await prisma.$queryRaw<[{ get_dashboard_stats: any }]>`
    SELECT get_dashboard_stats();
  `;
  const stats = result[0]?.get_dashboard_stats;
  if (!stats) {
    res.status(500).json({ error: "Failed to load dashboard statistics" });
    return;
  }
  res.json(stats);
});

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

  const reply = await prisma.reply.create({
    data: {
      ticketId,
      body: req.body.body,
    },
    select: replySelect,
  });

  res.status(201).json({ reply });
});

ticketsRouter.post("/:id/polish-reply", requireAgent, async (req, res) => {
  const ticketId = await requireTicketIdOrRespond(res, req.params.id);
  if (!ticketId) return;

  const { draft } = req.body as { draft?: unknown };
  if (typeof draft !== "string" || !draft.trim()) {
    res.status(400).json({ error: "draft must be a non-empty string" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { subject: true, body: true, fromName: true, fromEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const githubToken = process.env.GITHUB_MODELS_TOKEN;
  if (!githubToken) {
    res.status(500).json({ error: "GitHub Models token is not configured" });
    return;
  }

  const session = res.locals.agentSession!;
  const agentName = session.user.name ?? "Support Team";
  const agentEmail = `support@example.com`;

  // Determine customer name for personalised greeting
  const customerName = ticket.fromName?.trim()
    ? ticket.fromName.trim().split(" ")[0] // first name only
    : "there";

  const githubModels = createOpenAICompatible({
    name: "github-models",
    apiKey: githubToken,
    baseURL: "https://models.inference.ai.azure.com",
  });

  const { text } = await generateText({
    model: githubModels("o4-mini"),
    system: `You are a professional helpdesk agent assistant. Your job is to polish and improve agent reply drafts while keeping the same intent and tone. 
Guidelines:
- Fix grammar, spelling, and punctuation errors
- Make the language clearer and more professional
- Keep the same meaning and core content
- Maintain a helpful, empathetic tone
- Do not add new information or promises not in the original draft
- Always open the reply with: "Dear ${customerName},"
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
  });

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

  const githubToken = process.env.GITHUB_MODELS_TOKEN;
  if (!githubToken) {
    res.status(500).json({ error: "GitHub Models token is not configured" });
    return;
  }

  const githubModels = createOpenAICompatible({
    name: "github-models",
    apiKey: githubToken,
    baseURL: "https://models.inference.ai.azure.com",
  });

  const conversationHistory = ticket.replies
    .map((r, i) => {
      const role = r.isAi ? "Agent (AI)" : "Agent";
      return `Reply ${i + 1} [${role}]:\n${r.body}`;
    })
    .join("\n\n");

  const prompt = `Ticket subject: ${ticket.subject}

Customer (${ticket.fromName ?? ticket.fromEmail ?? "Unknown"}) original message:
${ticket.body}

${conversationHistory ? `Conversation history:\n${conversationHistory}` : "No replies yet."}`;

  const { text } = await generateText({
    model: githubModels("o4-mini"),
    system: `You are a concise helpdesk summarization assistant. Summarize the support ticket and its conversation history in 3-5 bullet points. Focus on:
- The customer's core issue or request
- Key actions taken or proposed by the support team
- Current status or outstanding next steps
Be concise and factual. Use plain text bullet points starting with "•".`,
    prompt,
  });

  res.json({ summary: text });
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
    const aiAgent = await prisma.user.findUnique({ where: { email: "ai@example.com" } });
    if (aiAgent) {
      finalAssignedToId = aiAgent.id;
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

  // Always run the full process-ticket job (classification + KB resolution)
  void enqueueProcessTicket({ ticketId: ticket.id, subject, body });

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

  const { status, category, assignedToId } = req.body;

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
