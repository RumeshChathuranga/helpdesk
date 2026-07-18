import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { prisma } from "../lib/prisma.js";
import { aiMockState, resetAiMockState } from "../test/mockAi.js";

const EMBED_DIM = 384;
// A normalized (magnitude 1) fixed vector so cosine similarity against an
// identical KnowledgeChunk row is exactly 1 — comfortably over the 0.75
// resolution threshold — without needing a real embedding model.
const FIXED_EMBEDDING = Array(EMBED_DIM).fill(1 / Math.sqrt(EMBED_DIM));
const FIXED_VECTOR_STRING = `[${FIXED_EMBEDDING.join(",")}]`;

mock.module("@huggingface/transformers", () => ({
  pipeline: async () => {
    return async (_text: string, _opts: unknown) => ({
      tolist: () => [FIXED_EMBEDDING],
    });
  },
}));

describe("runProcessTicket", () => {
  let runProcessTicket: typeof import("./processTicket.js").runProcessTicket;
  let aiAgentId: string;
  const createdTicketIds: string[] = [];
  const createdChunkIds: string[] = [];

  beforeAll(async () => {
    ({ runProcessTicket } = await import("./processTicket.js"));

    const aiAgent = await prisma.user.findUnique({
      where: { email: "ai@example.com" },
      select: { id: true },
    });
    if (!aiAgent) {
      throw new Error(
        "Seeded ai@example.com agent not found — run `bun prisma/seed-test.ts` against helpdesk_test.",
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

    if (createdChunkIds.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM "KnowledgeChunk" WHERE id = ANY(${createdChunkIds})
      `;
      createdChunkIds.length = 0;
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
    if (createdChunkIds.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM "KnowledgeChunk" WHERE id = ANY(${createdChunkIds})
      `;
    }
  });

  /** Mimics the state the pg-boss worker puts a ticket in before calling runProcessTicket. */
  async function createProcessingTicket(subject: string, body: string) {
    const ticket = await prisma.ticket.create({
      data: {
        subject,
        body,
        status: "PROCESSING",
        assignedToId: aiAgentId,
      },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function insertMatchingKnowledgeChunk(text: string): Promise<string> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "KnowledgeChunk" ("id", "text", "embedding")
      VALUES (gen_random_uuid()::text, ${text}, ${FIXED_VECTOR_STRING}::vector)
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) {
      throw new Error("Failed to insert test KnowledgeChunk fixture");
    }
    createdChunkIds.push(id);
    return id;
  }

  it("resolves the ticket and creates an AI reply when the model finds a KB answer", async () => {
    aiMockState.classificationCategory = "BILLING";
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
    expect(updated?.category).toBe("BILLING");
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

  it("escalates to OPEN and unassigns the AI agent when the model can't resolve it", async () => {
    aiMockState.classificationCategory = "TECHNICAL";
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
    expect(updated?.category).toBe("TECHNICAL");
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
    aiMockState.classificationCategory = "GENERAL";
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
    expect(updated?.category).toBe("GENERAL");
    expect(updated?.assignedToId).toBeNull();

    const replies = await prisma.reply.findMany({
      where: { ticketId: ticket.id },
    });
    expect(replies).toHaveLength(0);
    expect(aiMockState.resolutionCallCount).toBe(0);
  });
});
