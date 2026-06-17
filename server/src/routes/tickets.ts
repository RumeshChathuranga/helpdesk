import {
  createTicketBodySchema,
  listTicketsQuerySchema,
  updateTicketBodySchema,
} from "core";
import { Router, type IRouter } from "express";
import type { ZodError } from "zod";
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

ticketsRouter.get("/", requireAgent, async (req, res) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return;
  }

  const { status, category, sort } = parsed.data;
  const orderBy =
    sort === "createdAt_asc"
      ? { createdAt: "asc" as const }
      : { createdAt: "desc" as const };

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    },
    orderBy,
    select: ticketListSelect,
  });

  res.json({ tickets });
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
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          isAi: true,
          sentEmail: true,
          externalMessageId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ ticket });
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
