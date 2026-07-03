import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  DEFAULT_TICKET_LIST_SORT,
  DEFAULT_TICKET_PAGE_SIZE,
  listTicketsQuerySchema,
  ticketListSortToOrderBy,
  ticketListSortValues,
} from "core";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

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
  let integrationReady = false;
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    try {
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;

      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent@example.com",
          password: "password@123",
        }),
      });

      if (!loginRes.ok) {
        return;
      }

      authCookie = loginRes.headers.getSetCookie().join("; ");
      integrationReady = true;
    } catch {
      integrationReady = false;
    }
  });

  afterEach(async () => {
    if (!integrationReady || createdTicketIds.length === 0) {
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
    if (!integrationReady) {
      return;
    }

    const res = await listTickets("?sort=not-a-sort");

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBeTruthy();
  });

  it("returns 200 for each supported sort param", async () => {
    if (!integrationReady) {
      return;
    }

    for (const sort of ticketListSortValues) {
      const res = await listTickets(`?sort=${sort}`);
      expect(res.status).toBe(200);
    }
  });

  it("defaults to newest first when sort is omitted", async () => {
    if (!integrationReady) {
      return;
    }

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
    if (!integrationReady) {
      return;
    }

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
    if (!integrationReady) {
      return;
    }

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
    if (!integrationReady) {
      return;
    }

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
});

describe("GET /api/tickets/:id", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  let integrationReady = false;
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    try {
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;

      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent@example.com",
          password: "password@123",
        }),
      });

      if (!loginRes.ok) {
        return;
      }

      authCookie = loginRes.headers.getSetCookie().join("; ");
      integrationReady = true;
    } catch {
      integrationReady = false;
    }
  });

  afterEach(async () => {
    if (!integrationReady || createdTicketIds.length === 0) {
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
    if (!integrationReady) {
      return;
    }

    const agent = await prisma.user.findFirst({
      where: { email: "agent@example.com", deletedAt: null },
      select: { id: true },
    });
    if (!agent) {
      return;
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
    if (!integrationReady) {
      return;
    }

    const res = await getTicket("nonexistent-ticket-id");
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });
});

describe("PATCH /api/tickets/:id", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  let integrationReady = false;
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    try {
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;

      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent@example.com",
          password: "password@123",
        }),
      });

      if (!loginRes.ok) {
        return;
      }

      authCookie = loginRes.headers.getSetCookie().join("; ");
      integrationReady = true;
    } catch {
      integrationReady = false;
    }
  });

  afterEach(async () => {
    if (!integrationReady || createdTicketIds.length === 0) {
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
    if (!integrationReady) {
      return;
    }

    const agent = await prisma.user.findFirst({
      where: { email: "agent@example.com", deletedAt: null },
      select: { id: true },
    });
    if (!agent) {
      return;
    }

    const runId = crypto.randomUUID();
    const ticket = await prisma.ticket.create({
      data: {
        subject: `Patch ${runId}`,
        body: "Body",
        status: "OPEN",
        category: "GENERAL",
      },
    });
    createdTicketIds.push(ticket.id);

    const res = await patchTicket(ticket.id, {
      status: "IN_PROGRESS",
      category: "TECHNICAL",
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
    expect(json.ticket.category).toBe("TECHNICAL");
    expect(json.ticket.assignedToId).toBe(agent.id);
  });

  it("returns 404 for a missing ticket", async () => {
    if (!integrationReady) {
      return;
    }

    const res = await patchTicket("nonexistent-ticket-id", {
      status: "CLOSED",
    });
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/polish-reply
// ---------------------------------------------------------------------------
// The AI SDK is mocked with Bun's mock.module() so no real network calls are
// made to GitHub Models.  The rest of the test follows the same integration
// pattern used above (real Express server, real DB, auth cookie).

import { mock, spyOn } from "bun:test";

// Keep a reference to the stubbed generateText so individual tests can control
// its return value.  The mock is registered at module evaluation time so that
// Bun hoists it before the server imports the route.
let _resolvedText = "Please assist me.";

mock.module("ai", () => ({
  generateText: async (_opts: unknown) => ({ text: _resolvedText }),
}));

mock.module("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => () => ({}),
}));

describe("POST /api/tickets/:id/polish-reply", () => {
  let server: Server;
  let baseUrl: string;
  let authCookie = "";
  let integrationReady = false;
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    try {
      const { createApp } = await import("../app.js");
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;

      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent@example.com",
          password: "password@123",
        }),
      });

      if (!loginRes.ok) return;

      authCookie = loginRes.headers.getSetCookie().join("; ");
      integrationReady = true;
    } catch {
      integrationReady = false;
    }
  });

  afterEach(async () => {
    // Reset to the default polished text for the next test
    _resolvedText = "Please assist me.";

    if (!integrationReady || createdTicketIds.length === 0) return;

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
    if (!integrationReady) return;

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
    if (!integrationReady) return;

    const res = await polishReply("nonexistent-ticket-id", {
      draft: "Help me please.",
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Ticket not found");
  });

  it("returns 400 when draft is missing from the request body", async () => {
    if (!integrationReady) return;

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
    if (!integrationReady) return;

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
    if (!integrationReady) return;

    _resolvedText = "Please assist me at your earliest convenience.";

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
  let integrationReady = false;
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    try {
      const { createApp } = await import("../app.js");
      const app = createApp();
      server = app.listen(0);
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;

      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "agent@example.com",
          password: "password@123",
        }),
      });

      if (!loginRes.ok) return;

      authCookie = loginRes.headers.getSetCookie().join("; ");
      integrationReady = true;
    } catch {
      integrationReady = false;
    }
  });

  afterEach(async () => {
    if (!integrationReady || createdTicketIds.length === 0) return;

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

  async function getStats() {
    return fetch(`${baseUrl}/api/tickets/stats`, {
      headers: { Cookie: authCookie },
    });
  }

  it("returns 401 when not authenticated", async () => {
    if (!integrationReady) return;

    const res = await fetch(`${baseUrl}/api/tickets/stats`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 200 with dashboard statistics", async () => {
    if (!integrationReady) return;

    // Create a few tickets with different statuses
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

    const res = await getStats();
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      totalTickets: number;
      openTickets: number;
      resolvedTickets: number;
      aiResolvedCount: number;
      aiResolvedPct: number;
      chartData: { date: string; count: number }[];
    };

    expect(json.totalTickets).toBeGreaterThanOrEqual(2);
    expect(json.openTickets).toBeGreaterThanOrEqual(1);
    expect(json.resolvedTickets).toBeGreaterThanOrEqual(1);
    expect(json.aiResolvedCount).toBeGreaterThanOrEqual(1);
    expect(json.aiResolvedPct).toBe(100);
    expect(json.chartData).toHaveLength(30);
  });
});

