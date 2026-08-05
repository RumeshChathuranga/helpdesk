import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import {
  DEFAULT_TICKET_LIST_SORT,
  DEFAULT_TICKET_PAGE_SIZE,
  listTicketsQuerySchema,
  ticketListSortToOrderBy,
  ticketListSortValues,
} from "core";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { boss, startBoss } from "../lib/boss.js";
import { loginAsAgent, startTestServer } from "../test/helpers.js";
import { setEmailDriverForTesting } from "../lib/email/index.js";
import type { EmailDriver } from "../lib/email/index.js";
import { AI_AGENT_EMAIL } from "../config.js";

describe("ticketListSortToOrderBy", () => {
  it("maps subject sort", () => {
    expect(ticketListSortToOrderBy("subject_asc")).toEqual({ subject: "asc" });
    expect(ticketListSortToOrderBy("subject_desc")).toEqual({
      subject: "desc",
    });
  });

  it("maps status sort", () => {
    expect(ticketListSortToOrderBy("status_asc")).toEqual({ status: "asc" });
    expect(ticketListSortToOrderBy("status_desc")).toEqual({ status: "desc" });
  });

  it("maps category sort", () => {
    expect(ticketListSortToOrderBy("category_asc")).toEqual({
      category: "asc",
    });
    expect(ticketListSortToOrderBy("category_desc")).toEqual({
      category: "desc",
    });
  });

  it("maps createdAt sort", () => {
    expect(ticketListSortToOrderBy("createdAt_asc")).toEqual({
      createdAt: "asc",
    });
    expect(ticketListSortToOrderBy("createdAt_desc")).toEqual({
      createdAt: "desc",
    });
  });

  it("maps requester sort to fromName then fromEmail with nulls last", () => {
    expect(ticketListSortToOrderBy("requester_asc")).toEqual([
      { fromName: { sort: "asc", nulls: "last" } },
      { fromEmail: { sort: "asc", nulls: "last" } },
    ]);
    expect(ticketListSortToOrderBy("requester_desc")).toEqual([
      { fromName: { sort: "desc", nulls: "last" } },
      { fromEmail: { sort: "desc", nulls: "last" } },
    ]);
  });
});

describe("listTicketsQuerySchema", () => {
  it("accepts all supported sort values", () => {
    for (const sort of ticketListSortValues) {
      expect(listTicketsQuerySchema.safeParse({ sort }).success).toBe(true);
    }
  });

  it("rejects invalid sort values", () => {
    expect(listTicketsQuerySchema.safeParse({ sort: "invalid" }).success).toBe(
      false,
    );
  });

  it(`leaves sort undefined so the route can default to ${DEFAULT_TICKET_LIST_SORT}`, () => {
    const parsed = listTicketsQuerySchema.parse({});
    expect(parsed.sort).toBeUndefined();
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(DEFAULT_TICKET_PAGE_SIZE);
  });

  it("rejects invalid pagination params", () => {
    expect(listTicketsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listTicketsQuerySchema.safeParse({ pageSize: 0 }).success).toBe(
      false,
    );
    expect(listTicketsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(
      false,
    );
  });
});

describe("GET /api/tickets", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) {
      return;
    }

    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function listTickets(query = "") {
    return fetch(`${baseUrl}/api/tickets${query}`, {
      headers: { Cookie: authCookie },
    });
  }

  it("returns 400 for an invalid sort query param", async () => {
    const res = await listTickets("?sort=not-a-sort");

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBeTruthy();
  });

  it("returns 200 for each supported sort param", async () => {
    for (const sort of ticketListSortValues) {
      const res = await listTickets(`?sort=${sort}`);
      expect(res.status).toBe(200);
    }
  });

  it("defaults to newest first when sort is omitted", async () => {
    const runId = crypto.randomUUID();
    const older = await prisma.ticket.create({
      data: {
        subject: `Older ${runId}`,
        body: "Older body",
        status: "OPEN",
        createdAt: new Date("2024-01-01T12:00:00.000Z"),
      },
    });
    const newer = await prisma.ticket.create({
      data: {
        subject: `Newer ${runId}`,
        body: "Newer body",
        status: "OPEN",
        createdAt: new Date("2024-06-01T12:00:00.000Z"),
      },
    });
    createdTicketIds.push(older.id, newer.id);

    const res = await listTickets(
      `?search=${encodeURIComponent(runId)}&pageSize=100`,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      tickets: { id: string; subject: string }[];
    };
    const subjects = json.tickets.map((ticket) => ticket.subject);
    expect(subjects.indexOf(`Newer ${runId}`)).toBeLessThan(
      subjects.indexOf(`Older ${runId}`),
    );
  });

  it("sorts by subject ascending", async () => {
    const runId = crypto.randomUUID();
    const zebra = await prisma.ticket.create({
      data: { subject: `Zebra ${runId}`, body: "Z", status: "OPEN" },
    });
    const alpha = await prisma.ticket.create({
      data: { subject: `Alpha ${runId}`, body: "A", status: "OPEN" },
    });
    createdTicketIds.push(zebra.id, alpha.id);

    const res = await listTickets(
      `?sort=subject_asc&search=${encodeURIComponent(runId)}&pageSize=100`,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      tickets: { subject: string }[];
    };
    const runSubjects = json.tickets
      .map((ticket) => ticket.subject)
      .filter((subject) => subject.endsWith(runId));

    expect(runSubjects).toEqual([`Alpha ${runId}`, `Zebra ${runId}`]);
  });

  it("sorts by requester name ascending", async () => {
    const runId = crypto.randomUUID();
    const zara = await prisma.ticket.create({
      data: {
        subject: `Ticket Z ${runId}`,
        body: "Body",
        fromName: "Zara",
        fromEmail: "z@example.com",
        status: "OPEN",
      },
    });
    const anna = await prisma.ticket.create({
      data: {
        subject: `Ticket A ${runId}`,
        body: "Body",
        fromName: "Anna",
        fromEmail: "a@example.com",
        status: "OPEN",
      },
    });
    createdTicketIds.push(zara.id, anna.id);

    const res = await listTickets(
      `?sort=requester_asc&search=${encodeURIComponent(runId)}&pageSize=100`,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      tickets: { subject: string; fromName: string | null }[];
    };
    const runTickets = json.tickets.filter((ticket) =>
      ticket.subject.endsWith(runId),
    );

    expect(runTickets.map((ticket) => ticket.fromName)).toEqual([
      "Anna",
      "Zara",
    ]);
  });

  it("paginates ticket results", async () => {
    const runId = crypto.randomUUID();
    const first = await prisma.ticket.create({
      data: { subject: `Page A ${runId}`, body: "A", status: "OPEN" },
    });
    const second = await prisma.ticket.create({
      data: { subject: `Page B ${runId}`, body: "B", status: "OPEN" },
    });
    createdTicketIds.push(first.id, second.id);

    const res = await listTickets(
      `?sort=subject_asc&search=${encodeURIComponent(runId)}&page=2&pageSize=1`,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      tickets: { subject: string }[];
      total: number;
      page: number;
      pageSize: number;
    };

    expect(json.page).toBe(2);
    expect(json.pageSize).toBe(1);
    expect(json.total).toBeGreaterThanOrEqual(2);
    expect(json.tickets).toHaveLength(1);
    expect(json.tickets[0]?.subject).toBe(`Page B ${runId}`);
  });

  it("filters by requester type", async () => {
    const runId = crypto.randomUUID();
    const student = await prisma.ticket.create({
      data: {
        subject: `Student ${runId}`,
        body: "Body",
        status: "OPEN",
        requesterType: "STUDENT",
      },
    });
    const staff = await prisma.ticket.create({
      data: {
        subject: `Staff ${runId}`,
        body: "Body",
        status: "OPEN",
        requesterType: "ACADEMIC_STAFF",
      },
    });
    createdTicketIds.push(student.id, staff.id);

    const res = await listTickets(
      `?requesterType=STUDENT&search=${encodeURIComponent(runId)}&pageSize=100`,
    );
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      tickets: { subject: string }[];
    };
    const subjects = json.tickets.map((ticket) => ticket.subject);
    expect(subjects).toContain(`Student ${runId}`);
    expect(subjects).not.toContain(`Staff ${runId}`);
  });
});

describe("GET /api/tickets/:id", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) {
      return;
    }

    await prisma.reply.deleteMany({
      where: { ticketId: { in: [...createdTicketIds] } },
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function getTicket(id: string) {
    return fetch(`${baseUrl}/api/tickets/${id}`, {
      headers: { Cookie: authCookie },
    });
  }

  it("returns 200 with body, replies ordered asc, and assignedTo", async () => {
    const agent = await prisma.user.findFirst({
      where: { email: "agent@example.com", deletedAt: null },
      select: { id: true },
    });
    if (!agent) {
      throw new Error(
        "Seeded agent@example.com not found — run `bun prisma/seed-test.ts` against helpdesk_test.",
      );
    }

    const runId = crypto.randomUUID();
    const ticket = await prisma.ticket.create({
      data: {
        subject: `Detail ${runId}`,
        body: "Ticket body content",
        assignedToId: agent.id,
        status: "OPEN",
      },
    });
    createdTicketIds.push(ticket.id);

    const olderReply = await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        body: "First reply",
        createdAt: new Date("2024-01-01T12:00:00.000Z"),
      },
    });
    const newerReply = await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        body: "Second reply",
        createdAt: new Date("2024-06-01T12:00:00.000Z"),
      },
    });

    const res = await getTicket(ticket.id);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      ticket: {
        subject: string;
        body: string;
        assignedTo: { id: string; name: string; email: string } | null;
        replies: { id: string; body: string }[];
      };
    };

    expect(json.ticket.subject).toBe(`Detail ${runId}`);
    expect(json.ticket.body).toBe("Ticket body content");
    expect(json.ticket.assignedTo?.id).toBe(agent.id);
    expect(json.ticket.replies.map((r) => r.id)).toEqual([
      olderReply.id,
      newerReply.id,
    ]);
    expect(json.ticket.replies.map((r) => r.body)).toEqual([
      "First reply",
      "Second reply",
    ]);
  });

  it("returns 404 for a missing ticket", async () => {
    const res = await getTicket("nonexistent-ticket-id");
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });
});

describe("POST /api/tickets", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    // Idempotent — reopens the shared pg-boss singleton if another test file closed it.
    await startBoss();
    await boss.createQueue("process-ticket");

    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) {
      return;
    }

    await prisma.reply.deleteMany({
      where: { ticketId: { in: [...createdTicketIds] } },
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function createTicket(body: Record<string, unknown>) {
    return fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        Cookie: authCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when not authenticated", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Auth test", body: "Body" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when subject is missing", async () => {
    const res = await createTicket({ body: "No subject here" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBeTruthy();
  });

  it("creates a ticket, defaults category to OTHER, and auto-assigns the AI agent", async () => {
    const runId = crypto.randomUUID();
    const res = await createTicket({
      subject: `Created ${runId}`,
      body: "Please help me with this issue.",
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      ticket: {
        id: string;
        subject: string;
        category: string;
        status: string;
        assignedToId: string | null;
      };
    };
    createdTicketIds.push(json.ticket.id);

    expect(json.ticket.subject).toBe(`Created ${runId}`);
    expect(json.ticket.category).toBe("OTHER");
    // The job was enqueued successfully, so the ticket stays in its initial
    // NEW state — it is up to the (separately tested) worker to move it on.
    expect(json.ticket.status).toBe("NEW");

    const aiAgent = await prisma.user.findUnique({
      where: { email: AI_AGENT_EMAIL },
      select: { id: true },
    });
    if (aiAgent) {
      expect(json.ticket.assignedToId).toBe(aiAgent.id);
    }

    const stored = await prisma.ticket.findUnique({
      where: { id: json.ticket.id },
    });
    expect(stored?.subject).toBe(`Created ${runId}`);
  });

  it("respects an explicit category and assignee", async () => {
    const agent = await prisma.user.findFirst({
      where: { email: "agent@example.com", deletedAt: null },
      select: { id: true },
    });
    if (!agent) {
      throw new Error(
        "Seeded agent@example.com not found — run `bun prisma/seed-test.ts` against helpdesk_test.",
      );
    }

    const runId = crypto.randomUUID();
    const res = await createTicket({
      subject: `Billing issue ${runId}`,
      body: "I was double charged this month.",
      category: "ACCOUNT_ACCESS",
      assignedToId: agent.id,
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      ticket: { id: string; category: string; assignedToId: string | null };
    };
    createdTicketIds.push(json.ticket.id);

    expect(json.ticket.category).toBe("ACCOUNT_ACCESS");
    expect(json.ticket.assignedToId).toBe(agent.id);
  });
});

describe("PATCH /api/tickets/:id", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) {
      return;
    }

    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function patchTicket(id: string, body: Record<string, unknown>) {
    return fetch(`${baseUrl}/api/tickets/${id}`, {
      method: "PATCH",
      headers: {
        Cookie: authCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("updates status, category, and assignee", async () => {
    const agent = await prisma.user.findFirst({
      where: { email: "agent@example.com", deletedAt: null },
      select: { id: true },
    });
    if (!agent) {
      throw new Error(
        "Seeded agent@example.com not found — run `bun prisma/seed-test.ts` against helpdesk_test.",
      );
    }

    const runId = crypto.randomUUID();
    const ticket = await prisma.ticket.create({
      data: {
        subject: `Patch ${runId}`,
        body: "Body",
        status: "OPEN",
        category: "OTHER",
      },
    });
    createdTicketIds.push(ticket.id);

    const res = await patchTicket(ticket.id, {
      status: "IN_PROGRESS",
      category: "NETWORK",
      assignedToId: agent.id,
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      ticket: {
        status: string;
        category: string;
        assignedToId: string | null;
      };
    };

    expect(json.ticket.status).toBe("IN_PROGRESS");
    expect(json.ticket.category).toBe("NETWORK");
    expect(json.ticket.assignedToId).toBe(agent.id);
  });

  it("clears requesterType when explicitly set to null", async () => {
    const runId = crypto.randomUUID();
    const ticket = await prisma.ticket.create({
      data: {
        subject: `Patch requester ${runId}`,
        body: "Body",
        status: "OPEN",
        requesterType: "STUDENT",
      },
    });
    createdTicketIds.push(ticket.id);

    const res = await patchTicket(ticket.id, { requesterType: null });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      ticket: { requesterType: string | null };
    };
    expect(json.ticket.requesterType).toBeNull();
  });

  it("returns 404 for a missing ticket", async () => {
    const res = await patchTicket("nonexistent-ticket-id", {
      status: "CLOSED",
    });
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });
});

describe("DELETE /api/tickets/:id", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) {
      return;
    }

    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function deleteTicket(id: string) {
    return fetch(`${baseUrl}/api/tickets/${id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie },
    });
  }

  it("returns 401 when not authenticated", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "Auth test", body: "Body", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);

    const res = await fetch(`${baseUrl}/api/tickets/${ticket.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  it("deletes an existing ticket and its replies", async () => {
    const runId = crypto.randomUUID();
    const ticket = await prisma.ticket.create({
      data: { subject: `Delete me ${runId}`, body: "Body", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);

    await prisma.reply.create({
      data: { ticketId: ticket.id, body: "A reply" },
    });

    const res = await deleteTicket(ticket.id);
    expect(res.status).toBe(204);

    const stored = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(stored).toBeNull();

    const remainingReplies = await prisma.reply.findMany({
      where: { ticketId: ticket.id },
    });
    expect(remainingReplies).toHaveLength(0);

    // Already deleted — don't try to delete it again in afterEach.
    createdTicketIds.length = 0;
  });

  it("returns 404 for a missing ticket", async () => {
    const res = await deleteTicket("nonexistent-ticket-id");
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });
});

// ─── POST /api/tickets/:id/polish-reply ──────────────────────────────────────
// AI SDK mocked, see ../test/mockAi.ts.

import { aiMockState, resetAiMockState } from "../test/mockAi.js";

describe("POST /api/tickets/:id/polish-reply", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../app.js");
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    // Reset to the default polished text for the next test
    resetAiMockState();

    if (createdTicketIds.length === 0) return;

    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function polishReply(ticketId: string, body: unknown) {
    return fetch(`${baseUrl}/api/tickets/${ticketId}/polish-reply`, {
      method: "POST",
      headers: { Cookie: authCookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when not authenticated", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "Auth test", body: "Body", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);

    const res = await fetch(
      `${baseUrl}/api/tickets/${ticket.id}/polish-reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // no Cookie header → unauthenticated
        body: JSON.stringify({ draft: "hello" }),
      },
    );

    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-existent ticket", async () => {
    const res = await polishReply("nonexistent-ticket-id", {
      draft: "Help me please.",
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });

  it("returns 400 when draft is missing from the request body", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "Test subject", body: "Test body", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);

    const res = await polishReply(ticket.id, {});

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("draft must be a non-empty string");
  });

  it("returns 400 when draft is blank/whitespace only", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "Test subject", body: "Test body", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);

    const res = await polishReply(ticket.id, { draft: "   " });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("draft must be a non-empty string");
  });

  it("returns 200 with the polished text from the AI model", async () => {
    aiMockState.polishedText = "Please assist me at your earliest convenience.";

    const ticket = await prisma.ticket.create({
      data: {
        subject: "Need help",
        body: "I need asistance.",
        fromName: "Alice Smith",
        status: "OPEN",
      },
    });
    createdTicketIds.push(ticket.id);

    const res = await polishReply(ticket.id, { draft: "pleas assist me" });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { polished: string };
    expect(json.polished).toBe(
      "Please assist me at your earliest convenience.",
    );
  });
});

describe("GET /api/tickets/stats", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../app.js");
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) return;

    await prisma.reply.deleteMany({
      where: { ticketId: { in: [...createdTicketIds] } },
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: [...createdTicketIds] } },
    });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  interface DashboardStats {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    aiResolvedCount: number;
    aiResolvedPct: number;
    chartData: { date: string; count: number }[];
  }

  async function getStats(): Promise<DashboardStats> {
    const res = await fetch(`${baseUrl}/api/tickets/stats`, {
      headers: { Cookie: authCookie },
    });
    expect(res.status).toBe(200);
    return (await res.json()) as DashboardStats;
  }

  it("returns 401 when not authenticated", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/stats`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(401);
  });

  it("returns dashboard statistics whose deltas match the fixtures this test creates", async () => {
    // Baseline first — assertions below check deltas, not absolute counts,
    // since the test DB is shared.
    const before = await getStats();

    const ticket1 = await prisma.ticket.create({
      data: { subject: "Stats Open", body: "Body", status: "OPEN" },
    });
    const ticket2 = await prisma.ticket.create({
      data: { subject: "Stats Resolved", body: "Body", status: "RESOLVED" },
    });
    const ticket3 = await prisma.ticket.create({
      data: { subject: "Stats New", body: "Body", status: "NEW" }, // should be excluded
    });
    createdTicketIds.push(ticket1.id, ticket2.id, ticket3.id);

    // Create an AI reply for the resolved ticket to verify AI count
    await prisma.reply.create({
      data: {
        ticketId: ticket2.id,
        body: "AI reply text",
        isAi: true,
      },
    });

    const after = await getStats();

    expect(typeof after.totalTickets).toBe("number");
    expect(typeof after.openTickets).toBe("number");
    expect(typeof after.resolvedTickets).toBe("number");
    expect(typeof after.aiResolvedCount).toBe("number");
    expect(after.aiResolvedPct).toBeGreaterThanOrEqual(0);
    expect(after.aiResolvedPct).toBeLessThanOrEqual(100);
    expect(after.chartData).toHaveLength(30);

    expect(after.totalTickets - before.totalTickets).toBe(2);
    expect(after.openTickets - before.openTickets).toBe(1);
    expect(after.resolvedTickets - before.resolvedTickets).toBe(1);
    expect(after.aiResolvedCount - before.aiResolvedCount).toBe(1);
  });
});

// ─── POST /api/tickets/:id/replies + approve/discard/retry moderation ────────
// A stub email driver stands in for smtp/log, so no send-email job dangles.

describe("POST /api/tickets/:id/replies", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    await startBoss();
    await boss.createQueue("send-email");

    const stubDriver: EmailDriver = {
      name: "log",
      async send(message) {
        return { ok: true, messageId: message.messageId, accepted: [message.to] };
      },
    };
    setEmailDriverForTesting(stubDriver);

    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) return;

    await prisma.reply.deleteMany({ where: { ticketId: { in: [...createdTicketIds] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [...createdTicketIds] } } });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
    setEmailDriverForTesting(undefined);
  });

  async function createTicketFixture(fromEmail: string | null = "customer@example.com") {
    const ticket = await prisma.ticket.create({
      data: { subject: "Test subject", body: "Test body", fromEmail, status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function postReply(ticketId: string, body: Record<string, unknown>) {
    return fetch(`${baseUrl}/api/tickets/${ticketId}/replies`, {
      method: "POST",
      headers: { Cookie: authCookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when not authenticated", async () => {
    const ticket = await createTicketFixture();
    const res = await fetch(`${baseUrl}/api/tickets/${ticket.id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  it("defaults sendEmail to true and queues the send when the ticket has a fromEmail", async () => {
    const ticket = await createTicketFixture("customer@example.com");
    const res = await postReply(ticket.id, { body: "Thanks for reaching out." });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { reply: { deliveryState: string; sentEmail: boolean } };
    expect(json.reply.deliveryState).toBe("QUEUED");
  });

  it("defaults sendEmail to false when the ticket has no fromEmail", async () => {
    const ticket = await createTicketFixture(null);
    const res = await postReply(ticket.id, { body: "Internal note." });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { reply: { deliveryState: string } };
    expect(json.reply.deliveryState).toBe("NOT_QUEUED");
  });

  it("respects an explicit sendEmail: false even when the ticket has a fromEmail", async () => {
    const ticket = await createTicketFixture("customer@example.com");
    const res = await postReply(ticket.id, { body: "Not emailed.", sendEmail: false });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { reply: { deliveryState: string } };
    expect(json.reply.deliveryState).toBe("NOT_QUEUED");
  });

  it("returns 400 for an explicit sendEmail: true on a ticket with no fromEmail", async () => {
    const ticket = await createTicketFixture(null);
    const res = await postReply(ticket.id, { body: "Cannot email.", sendEmail: true });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("This ticket has no requester email address");
  });
});

describe("Reply moderation: approve / discard / retry-send", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    await startBoss();
    await boss.createQueue("send-email");

    const stubDriver: EmailDriver = {
      name: "log",
      async send(message) {
        return { ok: true, messageId: message.messageId, accepted: [message.to] };
      },
    };
    setEmailDriverForTesting(stubDriver);

    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    authCookie = await loginAsAgent(baseUrl);
  });

  afterEach(async () => {
    if (createdTicketIds.length === 0) return;

    await prisma.reply.deleteMany({ where: { ticketId: { in: [...createdTicketIds] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [...createdTicketIds] } } });
    createdTicketIds.length = 0;
  });

  afterAll(() => {
    server?.close();
    setEmailDriverForTesting(undefined);
  });

  async function createPendingDraft(fromEmail: string | null = "customer@example.com") {
    const ticket = await prisma.ticket.create({
      data: { subject: "Test subject", body: "Test body", fromEmail, status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);

    const reply = await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        body: "AI draft reply",
        isAi: true,
        direction: "OUTBOUND",
        approval: "PENDING_APPROVAL",
        deliveryState: "NOT_QUEUED",
      },
    });

    return { ticket, reply };
  }

  async function postAction(ticketId: string, replyId: string, action: string, body?: unknown) {
    return fetch(`${baseUrl}/api/tickets/${ticketId}/replies/${replyId}/${action}`, {
      method: "POST",
      headers: { Cookie: authCookie, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  it("returns 401 for approve when not authenticated", async () => {
    const { ticket, reply } = await createPendingDraft();
    const res = await fetch(
      `${baseUrl}/api/tickets/${ticket.id}/replies/${reply.id}/approve`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    expect(res.status).toBe(401);
  });

  it("approves a pending draft, queues the send, and records the approver", async () => {
    const { ticket, reply } = await createPendingDraft();
    const res = await postAction(ticket.id, reply.id, "approve", {});

    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: { approval: string; deliveryState: string } };
    expect(json.reply.approval).toBe("APPROVED");
    expect(json.reply.deliveryState).toBe("QUEUED");

    const stored = await prisma.reply.findUniqueOrThrow({ where: { id: reply.id } });
    expect(stored.approvedById).not.toBeNull();
  });

  it("allows editing the body on approve", async () => {
    const { ticket, reply } = await createPendingDraft();
    const res = await postAction(ticket.id, reply.id, "approve", { body: "Edited reply text" });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: { body: string } };
    expect(json.reply.body).toBe("Edited reply text");
  });

  it("returns 409 approving a reply that is not pending approval", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "s", body: "b", fromEmail: "c@example.com", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);
    const reply = await prisma.reply.create({
      data: { ticketId: ticket.id, body: "Regular reply", approval: "NOT_REQUIRED" },
    });

    const res = await postAction(ticket.id, reply.id, "approve", {});
    expect(res.status).toBe(409);
  });

  it("returns 400 approving a draft on a ticket with no fromEmail", async () => {
    const { ticket, reply } = await createPendingDraft(null);
    const res = await postAction(ticket.id, reply.id, "approve", {});
    expect(res.status).toBe(400);
  });

  it("returns 404 when the reply does not belong to the ticket", async () => {
    const { reply } = await createPendingDraft();
    const otherTicket = await createPendingDraft();

    const res = await postAction(otherTicket.ticket.id, reply.id, "approve", {});
    expect(res.status).toBe(404);
  });

  it("discards a pending draft without sending it, leaving the ticket status untouched", async () => {
    const { ticket, reply } = await createPendingDraft();
    const res = await postAction(ticket.id, reply.id, "discard");

    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: { approval: string; deliveryState: string } };
    expect(json.reply.approval).toBe("DISCARDED");
    expect(json.reply.deliveryState).toBe("NOT_QUEUED");

    const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketAfter.status).toBe("OPEN");
  });

  it("returns 409 discarding a reply that is not pending approval", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "s", body: "b", fromEmail: "c@example.com", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);
    const reply = await prisma.reply.create({
      data: { ticketId: ticket.id, body: "Regular reply", approval: "NOT_REQUIRED" },
    });

    const res = await postAction(ticket.id, reply.id, "discard");
    expect(res.status).toBe(409);
  });

  it("retries a failed send and clears the delivery error", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "s", body: "b", fromEmail: "c@example.com", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);
    const reply = await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        body: "Failed reply",
        direction: "OUTBOUND",
        deliveryState: "FAILED",
        deliveryError: "SMTP timeout",
      },
    });

    const res = await postAction(ticket.id, reply.id, "retry-send");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reply: { deliveryState: string; deliveryError: string | null } };
    expect(json.reply.deliveryState).toBe("QUEUED");
    expect(json.reply.deliveryError).toBeNull();
  });

  it("returns 409 retrying a reply that has not failed", async () => {
    const ticket = await prisma.ticket.create({
      data: { subject: "s", body: "b", fromEmail: "c@example.com", status: "OPEN" },
    });
    createdTicketIds.push(ticket.id);
    const reply = await prisma.reply.create({
      data: { ticketId: ticket.id, body: "Sent reply", deliveryState: "SENT" },
    });

    const res = await postAction(ticket.id, reply.id, "retry-send");
    expect(res.status).toBe(409);
  });
});
