import { pipeline } from "@huggingface/transformers";
import type { Job } from "pg-boss";
import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";

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
        // Load the feature extraction pipeline. 
        // This downloads weights on first run and caches them locally.
        const extractor = await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2"
        );

        // Generate embedding tensor
        const output = await extractor(text, { pooling: "mean", normalize: true });
        
        // Convert to standard JS array
        const embeddingArray = Array.from(output.tolist()[0] as number[]);

        // Serialize array to a Postgres vector array string format: '[val1, val2, ...]'
        const vectorString = `[${embeddingArray.join(',')}]`;

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
