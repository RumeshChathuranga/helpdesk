import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../lib/prisma.js";
import { aiMockState, resetAiMockState } from "../test/mockAi.js";
import { FIXED_VECTOR_STRING } from "../test/mockEmbeddings.js";
import { AI_AGENT_EMAIL } from "../config.js";
import { ticketPipelineDuration, ticketsProcessed } from "../lib/metrics.js";

async function outcomeCount(outcome: string): Promise<number> {
  const { values } = await ticketsProcessed.get();
  return values.find((v) => v.labels.outcome === outcome)?.value ?? 0;
}

describe("runProcessTicket", () => {
  let runProcessTicket: typeof import("./processTicket.js").runProcessTicket;
  let aiAgentId: string;
  const createdTicketIds: string[] = [];
  // Chunks cascade with their document, so only document ids need tracking.
  const createdDocumentIds: string[] = [];

  beforeAll(async () => {
    ({ runProcessTicket } = await import("./processTicket.js"));

    const aiAgent = await prisma.user.findUnique({
      where: { email: AI_AGENT_EMAIL },
      select: { id: true },
    });
    if (!aiAgent) {
      throw new Error(
        `Seeded ${AI_AGENT_EMAIL} agent not found — run \`bun prisma/seed-test.ts\` against helpdesk_test.`,
      );
    }
    aiAgentId = aiAgent.id;
  });

  afterEach(async () => {
    resetAiMockState();

    if (createdTicketIds.length > 0) {
      await prisma.reply.deleteMany({
        where: { ticketId: { in: [...createdTicketIds] } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: [...createdTicketIds] } },
      });
      createdTicketIds.length = 0;
    }

    if (createdDocumentIds.length > 0) {
      await prisma.knowledgeDocument.deleteMany({
        where: { id: { in: [...createdDocumentIds] } },
      });
      createdDocumentIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.reply.deleteMany({
        where: { ticketId: { in: [...createdTicketIds] } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: [...createdTicketIds] } },
      });
    }
    if (createdDocumentIds.length > 0) {
      await prisma.knowledgeDocument.deleteMany({
        where: { id: { in: [...createdDocumentIds] } },
      });
    }
  });

  /** Mimics the state the pg-boss worker puts a ticket in before calling runProcessTicket. */
  async function createProcessingTicket(
    subject: string,
    body: string,
    fromEmail?: string,
  ) {
    const ticket = await prisma.ticket.create({
      data: {
        subject,
        body,
        fromEmail,
        status: "PROCESSING",
        assignedToId: aiAgentId,
      },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  /** Creates a knowledge document plus one chunk whose embedding matches the
   *  stubbed query vector exactly (cosine similarity 1.0). */
  async function insertMatchingKnowledgeChunk(text: string): Promise<string> {
    const document = await prisma.knowledgeDocument.create({
      data: { title: text.slice(0, 60), text, status: "READY", chunkCount: 1 },
      select: { id: true },
    });
    createdDocumentIds.push(document.id);

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "KnowledgeChunk" ("id", "documentId", "chunkIndex", "text", "embedding")
      VALUES (gen_random_uuid()::text, ${document.id}, 0, ${text}, ${FIXED_VECTOR_STRING}::vector)
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("Failed to insert test KnowledgeChunk fixture");
    }
    return id;
  }

  it("resolves the ticket and creates an AI reply when the model finds a KB answer", async () => {
    aiMockState.classificationCategory = "ACCOUNT_ACCESS";
    aiMockState.resolution = {
      resolved: true,
      reply: "Here is your answer based on our knowledge base.",
    };
    await insertMatchingKnowledgeChunk(
      "Refunds are processed within 5 business days.",
    );

    const ticket = await createProcessingTicket(
      "Refund question",
      "Where is my refund?",
    );

    await runProcessTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      body: ticket.body,
      aiAgent: { id: aiAgentId },
      githubToken: "fake-token",
    });

    const updated = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updated?.status).toBe("RESOLVED");
    expect(updated?.category).toBe("ACCOUNT_ACCESS");
    expect(updated?.assignedToId).toBe(aiAgentId);

    const replies = await prisma.reply.findMany({
      where: { ticketId: ticket.id },
    });
    expect(replies).toHaveLength(1);
    expect(replies[0]?.isAi).toBe(true);
    expect(replies[0]?.body).toBe(
      "Here is your answer based on our knowledge base.",
    );
  });

  it("parks the AI reply as a pending-approval draft and escalates to OPEN for an email-sourced ticket, instead of auto-resolving", async () => {
    aiMockState.classificationCategory = "ACCOUNT_ACCESS";
    aiMockState.resolution = {
      resolved: true,
      reply: "Here is your answer based on our knowledge base.",
    };
    await insertMatchingKnowledgeChunk(
      "Refunds are processed within 5 business days.",
    );

    const ticket = await createProcessingTicket(
      "Refund question",
      "Where is my refund?",
      "customer@example.com",
    );

    await runProcessTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      body: ticket.body,
      aiAgent: { id: aiAgentId },
      githubToken: "fake-token",
    });

    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.status).toBe("OPEN");
    expect(updated?.assignedToId).toBeNull();

    const replies = await prisma.reply.findMany({ where: { ticketId: ticket.id } });
    expect(replies).toHaveLength(1);
    expect(replies[0]?.isAi).toBe(true);
    expect(replies[0]?.approval).toBe("PENDING_APPROVAL");
    expect(replies[0]?.deliveryState).toBe("NOT_QUEUED");
  });

  it("escalates to OPEN and unassigns the AI agent when the model can't resolve it", async () => {
    aiMockState.classificationCategory = "NETWORK";
    aiMockState.resolution = { resolved: false, reply: undefined };
    await insertMatchingKnowledgeChunk(
      "KB content that matches the mocked embedding but isn't a full answer.",
    );

    const ticket = await createProcessingTicket(
      "Weird bug",
      "Something is broken and I'm not sure what.",
    );

    await runProcessTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      body: ticket.body,
      aiAgent: { id: aiAgentId },
      githubToken: "fake-token",
    });

    const updated = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updated?.status).toBe("OPEN");
    expect(updated?.category).toBe("NETWORK");
    expect(updated?.assignedToId).toBeNull();

    const replies = await prisma.reply.findMany({
      where: { ticketId: ticket.id },
    });
    expect(replies).toHaveLength(0);
    // Confirms this test actually exercised the resolution prompt (as
    // opposed to short-circuiting via the RAG-miss path below).
    expect(aiMockState.resolutionCallCount).toBe(1);
  });

  it("escalates to OPEN without ever calling the resolution prompt when no KB chunk matches", async () => {
    aiMockState.classificationCategory = "OTHER";
    // Intentionally no matching KnowledgeChunk inserted for this ticket.

    const ticket = await createProcessingTicket(
      "No KB match",
      "Totally novel question nobody has asked before.",
    );

    await runProcessTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      body: ticket.body,
      aiAgent: { id: aiAgentId },
      githubToken: "fake-token",
    });

    const updated = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(updated?.status).toBe("OPEN");
    expect(updated?.category).toBe("OTHER");
    expect(updated?.assignedToId).toBeNull();

    const replies = await prisma.reply.findMany({
      where: { ticketId: ticket.id },
    });
    expect(replies).toHaveLength(0);
    expect(aiMockState.resolutionCallCount).toBe(0);
  });

  it("records the terminal outcome and the pipeline latency for the auto-resolve path", async () => {
    const before = await outcomeCount("resolved");

    aiMockState.classificationCategory = "ACCOUNT_ACCESS";
    aiMockState.resolution = { resolved: true, reply: "Answer from the knowledge base." };
    await insertMatchingKnowledgeChunk("Refunds are processed within 5 business days.");

    const ticket = await createProcessingTicket("Refund question", "Where is my refund?");

    await runProcessTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      body: ticket.body,
      aiAgent: { id: aiAgentId },
      githubToken: "fake-token",
    });

    expect(await outcomeCount("resolved")).toBe(before + 1);

    // The histogram is what the auto-resolve SLO is measured against, so an
    // outcome recorded without a duration would be a silent hole in it.
    const { values } = await ticketPipelineDuration.get();
    const observed = values.find(
      (v) => v.metricName?.endsWith("_count") && v.labels.outcome === "resolved",
    );
    expect(observed?.value).toBeGreaterThan(0);
  });
});
