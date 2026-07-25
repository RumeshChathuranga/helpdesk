import type { Job } from "pg-boss";
import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";
import { embedText } from "../lib/embeddings.js";

// ─── Job contract ─────────────────────────────────────────────────────────────

export const EMBED_DOCUMENT_QUEUE = "embed-document" as const;

export interface EmbedDocumentJobData {
  text: string;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Registers the embed-document worker with pg-boss.
 * Handles extracting embeddings using Xenova/all-MiniLM-L6-v2 and storing them in the KnowledgeChunk table.
 * Must be called once after boss.start() during server startup.
 */
export async function registerEmbedDocumentWorker(): Promise<void> {
  await boss.createQueue(EMBED_DOCUMENT_QUEUE);

  // We limit concurrency if needed, but for now we rely on default pg-boss behaviour.
  await boss.work<EmbedDocumentJobData>(
    EMBED_DOCUMENT_QUEUE,
    async (jobs: Job<EmbedDocumentJobData>[]) => {
      const job = jobs[0];
      if (!job) return;
      
      const { text } = job.data;

      console.info(`[embed-document] Processing job ${job.id}`);

      try {
        // Embedding weights download on first run and are cached locally; the
        // pipeline instance itself is cached process-wide in lib/embeddings.ts.
        const { vectorString } = await embedText(text);

        // Save to KnowledgeChunk using raw query due to Unsupported("vector(384)")
        await prisma.$executeRaw`
          INSERT INTO "KnowledgeChunk" ("id", "text", "embedding") 
          VALUES (
            gen_random_uuid()::text, 
            ${text}, 
            ${vectorString}::vector
          )
        `;

        console.info(`[embed-document] Job ${job.id} completed successfully`);
      } catch (err) {
        console.error(`[embed-document] Job ${job.id} failed:`, err);
        throw err; // Allow pg-boss to handle retries
      }
    }
  );

  console.log(`[pg-boss] Worker registered for queue: ${EMBED_DOCUMENT_QUEUE}`);
}

// ─── Enqueue helper ───────────────────────────────────────────────────────────

/**
 * Enqueues an embed-document job. Returns the job ID.
 * Safe to fire-and-forget — job is persisted in Postgres.
 */
export async function enqueueEmbedDocument(
  data: EmbedDocumentJobData
): Promise<string | null> {
  return boss.send(EMBED_DOCUMENT_QUEUE, data);
}
