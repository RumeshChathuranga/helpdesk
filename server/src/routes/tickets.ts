import {
  createReplyBodySchema,
  createTicketBodySchema,
  DEFAULT_TICKET_LIST_SORT,
  DEFAULT_TICKET_PAGE_SIZE,
  listTicketsQuerySchema,
  ticketListSortToOrderBy,
  updateTicketBodySchema,
} from "core";
import { Router, type IRouter, type Response } from "express";
import type { Prisma } from "@prisma/client";
import type { ZodError, ZodType } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAgent } from "../middleware/requireAgent.js";

function firstZodIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function parseRouteId(
  id: string | string[] | undefined,
): string | undefined {
  if (typeof id === "string") {
    return id;
  }
  return id?.[0];
}

function parseBodyOrRespond<T>(
  res: Response,
  schema: ZodType<T>,
  body: unknown,
): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return null;
  }
  return parsed.data;
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

ticketsRouter.get("/", requireAgent, async (req, res) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return;
  }

  const { status, category, sort, search, page, pageSize } = parsed.data;
  const orderBy = ticketListSortToOrderBy(sort ?? DEFAULT_TICKET_LIST_SORT);
  const where = {
    ...(status ? { status } : {}),
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

ticketsRouter.post("/:id/replies", requireAgent, async (req, res) => {
  const input = parseBodyOrRespond(res, createReplyBodySchema, req.body);
  if (!input) return;

  const ticketId = await requireTicketIdOrRespond(res, req.params.id);
  if (!ticketId) return;

  const reply = await prisma.reply.create({
    data: {
      ticketId,
      body: input.body,
    },
    select: replySelect,
  });

  res.status(201).json({ reply });
});

ticketsRouter.post("/", requireAgent, async (req, res) => {
  const parsed = createTicketBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return;
  }

  const session = res.locals.agentSession;
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { subject, body, category, assignedToId } = parsed.data;

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

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      body,
      category: category ?? "OTHER",
      assignedToId,
      createdById: session.user.id,
    },
    select: {
      ...ticketListSelect,
      body: true,
    },
  });

  res.status(201).json({ ticket });
});

ticketsRouter.patch("/:id", requireAgent, async (req, res) => {
  const parsed = updateTicketBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return;
  }

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

  const { status, category, assignedToId } = parsed.data;

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
