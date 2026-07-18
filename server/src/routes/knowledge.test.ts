import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "../lib/prisma.js";
import { loginAsAdmin, startTestServer } from "../test/helpers.js";

// Mock the embed-document job module so POST /api/knowledge never touches
// pg-boss or the embedding pipeline — we only need to verify the route
// enqueues with the right payload and responds correctly.
let lastEnqueuedText: string | undefined;
let enqueueShouldThrow = false;

mock.module("../jobs/embed-document.js", () => ({
  enqueueEmbedDocument: async (data: { text: string }) => {
    if (enqueueShouldThrow) {
      throw new Error("boom");
    }
    lastEnqueuedText = data.text;
    return "fake-job-id";
  },
}));

const ZERO_VECTOR = `[${Array(384).fill(0).join(",")}]`;

async function insertKnowledgeChunk(text: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "KnowledgeChunk" ("id", "text", "embedding")
    VALUES (gen_random_uuid()::text, ${text}, ${ZERO_VECTOR}::vector)
    RETURNING id
  `;
  const id = rows[0]?.id;
  if (!id) {
    throw new Error("Failed to insert test KnowledgeChunk fixture");
  }
  return id;
}

describe("Knowledge routes", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie = "";
  const createdChunkIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../app.js");
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    adminCookie = await loginAsAdmin(baseUrl);
  });

  afterEach(async () => {
    lastEnqueuedText = undefined;
    enqueueShouldThrow = false;

    if (createdChunkIds.length === 0) return;

    await prisma.$executeRaw`
      DELETE FROM "KnowledgeChunk" WHERE id = ANY(${createdChunkIds})
    `;
    createdChunkIds.length = 0;
  });

  afterAll(() => {
    server?.close();
  });

  async function asAdmin(path: string, method: string, body?: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  describe("GET /api/knowledge", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await fetch(`${baseUrl}/api/knowledge`);
      expect(res.status).toBe(401);
    });

    it("lists knowledge chunks", async () => {
      const runId = crypto.randomUUID();
      const chunkId = await insertKnowledgeChunk(`Fixture text ${runId}`);
      createdChunkIds.push(chunkId);

      const res = await asAdmin("/api/knowledge", "GET");
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        chunks: { id: string; text: string }[];
      };
      expect(
        json.chunks.some(
          (chunk) => chunk.id === chunkId && chunk.text === `Fixture text ${runId}`,
        ),
      ).toBe(true);
    });
  });

  describe("POST /api/knowledge", () => {
    it("returns 400 when text is missing", async () => {
      const res = await asAdmin("/api/knowledge", "POST", {});
      expect(res.status).toBe(400);
    });

    it("returns 202 and queues an embed-document job", async () => {
      const runId = crypto.randomUUID();
      const res = await asAdmin("/api/knowledge", "POST", {
        text: `New knowledge ${runId}`,
      });

      expect(res.status).toBe(202);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
      expect(lastEnqueuedText).toBe(`New knowledge ${runId}`);
    });

    it("returns 500 when enqueueing fails", async () => {
      enqueueShouldThrow = true;

      const res = await asAdmin("/api/knowledge", "POST", {
        text: "This will fail to enqueue",
      });

      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /api/knowledge/:id", () => {
    it("removes the knowledge chunk", async () => {
      const runId = crypto.randomUUID();
      const chunkId = await insertKnowledgeChunk(`Delete me ${runId}`);

      const res = await asAdmin(`/api/knowledge/${chunkId}`, "DELETE");
      expect(res.status).toBe(204);

      const remaining = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "KnowledgeChunk" WHERE id = ${chunkId}
      `;
      expect(remaining).toHaveLength(0);
    });
  });
});
