import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "../lib/prisma.js";
import { loginAsAdmin, startTestServer } from "../test/helpers.js";

// Mock the embed-document job module so POST /api/knowledge never touches
// pg-boss or the embedding pipeline — we only need to verify the route
// enqueues with the right payload and responds correctly.
let lastEnqueuedDocumentId: string | undefined;
let enqueueShouldThrow = false;

mock.module("../jobs/embed-document.js", () => ({
  enqueueEmbedDocument: async (data: { documentId: string }) => {
    if (enqueueShouldThrow) {
      throw new Error("boom");
    }
    lastEnqueuedDocumentId = data.documentId;
    return "fake-job-id";
  },
}));

const ZERO_VECTOR = `[${Array(384).fill(0).join(",")}]`;

describe("Knowledge routes", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie = "";
  const createdDocumentIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../app.js");
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
    adminCookie = await loginAsAdmin(baseUrl);
  });

  afterEach(async () => {
    lastEnqueuedDocumentId = undefined;
    enqueueShouldThrow = false;

    if (createdDocumentIds.length === 0) return;

    // Chunks cascade with their document.
    await prisma.knowledgeDocument.deleteMany({
      where: { id: { in: createdDocumentIds } },
    });
    createdDocumentIds.length = 0;
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

  /** Creates a READY document plus one chunk, tracked for cleanup. */
  async function createDocument(title: string, text = "Fixture body"): Promise<string> {
    const document = await prisma.knowledgeDocument.create({
      data: { title, text, status: "READY", chunkCount: 1 },
      select: { id: true },
    });
    createdDocumentIds.push(document.id);

    await prisma.$executeRaw`
      INSERT INTO "KnowledgeChunk" ("id", "documentId", "chunkIndex", "text", "embedding")
      VALUES (gen_random_uuid()::text, ${document.id}, 0, ${text}, ${ZERO_VECTOR}::vector)
    `;

    return document.id;
  }

  describe("GET /api/knowledge", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await fetch(`${baseUrl}/api/knowledge`);
      expect(res.status).toBe(401);
    });

    it("lists knowledge documents with a pagination envelope", async () => {
      const runId = crypto.randomUUID();
      const documentId = await createDocument(`Fixture doc ${runId}`);

      const res = await asAdmin("/api/knowledge", "GET");
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        documents: { id: string; title: string; chunkCount: number }[];
        total: number;
        page: number;
        pageSize: number;
      };

      expect(json.page).toBe(1);
      expect(json.pageSize).toBe(10);
      expect(typeof json.total).toBe("number");
      // Newest first, so a just-created fixture is on page 1.
      expect(json.documents.some((doc) => doc.id === documentId)).toBe(true);
    });

    it("paginates and never returns more than pageSize rows", async () => {
      const runId = crypto.randomUUID();
      await createDocument(`Page fixture A ${runId}`);
      await createDocument(`Page fixture B ${runId}`);

      const res = await asAdmin("/api/knowledge?page=1&pageSize=1", "GET");
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        documents: unknown[];
        total: number;
        page: number;
        pageSize: number;
      };

      expect(json.documents).toHaveLength(1);
      expect(json.page).toBe(1);
      expect(json.pageSize).toBe(1);
      expect(json.total).toBeGreaterThanOrEqual(2);
    });

    it("filters by search term", async () => {
      const runId = crypto.randomUUID();
      const documentId = await createDocument(`Searchable ${runId}`);
      await createDocument(`Unrelated ${crypto.randomUUID()}`);

      const res = await asAdmin(`/api/knowledge?search=Searchable ${runId}`, "GET");
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        documents: { id: string }[];
        total: number;
      };

      expect(json.total).toBe(1);
      expect(json.documents[0]?.id).toBe(documentId);
    });

    it("returns 400 for an out-of-range pageSize", async () => {
      const res = await asAdmin("/api/knowledge?pageSize=500", "GET");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/knowledge/:id", () => {
    it("returns the document with its chunks", async () => {
      const runId = crypto.randomUUID();
      const documentId = await createDocument(`Detail doc ${runId}`, `Body ${runId}`);

      const res = await asAdmin(`/api/knowledge/${documentId}`, "GET");
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        document: {
          id: string;
          text: string;
          chunks: { chunkIndex: number; text: string }[];
        };
      };

      expect(json.document.id).toBe(documentId);
      expect(json.document.text).toBe(`Body ${runId}`);
      expect(json.document.chunks).toHaveLength(1);
      expect(json.document.chunks[0]?.chunkIndex).toBe(0);
    });

    it("returns 404 for an unknown id", async () => {
      const res = await asAdmin("/api/knowledge/does-not-exist", "GET");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/knowledge", () => {
    it("returns 400 when text is missing", async () => {
      const res = await asAdmin("/api/knowledge", "POST", { title: "No body" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when title is missing", async () => {
      const res = await asAdmin("/api/knowledge", "POST", { text: "No title" });
      expect(res.status).toBe(400);
    });

    it("returns 201 with a PENDING document and queues an embed-document job", async () => {
      const runId = crypto.randomUUID();
      const res = await asAdmin("/api/knowledge", "POST", {
        title: `New doc ${runId}`,
        text: `New knowledge ${runId}`,
      });

      expect(res.status).toBe(201);

      const json = (await res.json()) as {
        document: { id: string; title: string; status: string; chunkCount: number };
      };
      createdDocumentIds.push(json.document.id);

      expect(json.document.title).toBe(`New doc ${runId}`);
      expect(json.document.status).toBe("PENDING");
      expect(json.document.chunkCount).toBe(0);
      expect(lastEnqueuedDocumentId).toBe(json.document.id);
    });

    it("returns 500 when enqueueing fails", async () => {
      enqueueShouldThrow = true;

      const res = await asAdmin("/api/knowledge", "POST", {
        title: "Enqueue failure",
        text: "This will fail to enqueue",
      });

      expect(res.status).toBe(500);

      // The document row is still created — the sweep is a re-embed, not a leak.
      const orphan = await prisma.knowledgeDocument.findFirst({
        where: { title: "Enqueue failure" },
        select: { id: true },
      });
      if (orphan) createdDocumentIds.push(orphan.id);
    });
  });

  describe("DELETE /api/knowledge/:id", () => {
    it("removes the document and cascades its chunks", async () => {
      const runId = crypto.randomUUID();
      const documentId = await createDocument(`Delete me ${runId}`);

      const res = await asAdmin(`/api/knowledge/${documentId}`, "DELETE");
      expect(res.status).toBe(204);

      const remainingChunks = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "KnowledgeChunk" WHERE "documentId" = ${documentId}
      `;
      expect(remainingChunks).toHaveLength(0);

      const remainingDoc = await prisma.knowledgeDocument.findUnique({
        where: { id: documentId },
        select: { id: true },
      });
      expect(remainingDoc).toBeNull();
    });

    it("returns 404 for an unknown id", async () => {
      const res = await asAdmin("/api/knowledge/does-not-exist", "DELETE");
      expect(res.status).toBe(404);
    });
  });
});
