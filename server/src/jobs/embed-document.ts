import { KnowledgeStatus, Prisma } from "@prisma/client";
import type { Job } from "pg-boss";
import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";
import { chunkText } from "../lib/chunkText.js";
import { embedTexts, getTokenCounter } from "../lib/embeddings.js";

// ─── Job contract ─────────────────────────────────────────────────────────────

export const EMBED_DOCUMENT_QUEUE = "embed-document" as const;

export interface EmbedDocumentJobData {
  documentId: string;
}

/** Truncation for the KnowledgeDocument.error column — messages are for humans. */
const MAX_ERROR_LENGTH = 500;

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Chunks a document, embeds every chunk, and replaces its chunk rows.
 * Delete-then-insert in one transaction makes a retry converge on the same
 * rows instead of duplicating. Exported separately so tests skip pg-boss.
 */
export async function runEmbedDocument(documentId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: { id: true, text: true },
  });

  if (!document) {
    console.warn(`[embed-document] Document ${documentId} no longer exists, skipping`);
    return;
  }

  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: KnowledgeStatus.PROCESSING, error: null },
  });

  try {
    // Measure with the model's own tokenizer, matching the window it truncates at.
    const countTokens = await getTokenCounter();
    const chunks = chunkText(document.text, { countTokens });

    if (chunks.length === 0) {
      await prisma.$transaction([
        prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
        prisma.knowledgeDocument.update({
          where: { id: documentId },
          data: { status: KnowledgeStatus.READY, chunkCount: 0, error: null },
        }),
      ]);
      console.warn(`[embed-document] Document ${documentId} produced no chunks`);
      return;
    }

    const embeddings = await embedTexts(chunks);

    // Raw insert — `embedding` is Unsupported("vector(384)"), unreachable via the typed client.
    const values = chunks.map((text, index) =>
      Prisma.sql`(gen_random_uuid()::text, ${documentId}, ${index}, ${text}, ${embeddings[index]!.vectorString}::vector)`,
    );

    await prisma.$transaction([
      prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
      prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" ("id", "documentId", "chunkIndex", "text", "embedding")
        VALUES ${Prisma.join(values)}
      `,
      prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: KnowledgeStatus.READY,
          chunkCount: chunks.length,
          error: null,
        },
      }),
    ]);

    console.info(
      `[embed-document] Document ${documentId} embedded into ${chunks.length} chunk(s)`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: KnowledgeStatus.FAILED,
        error: message.slice(0, MAX_ERROR_LENGTH),
      },
    });
    throw err; // let pg-boss retry
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

/** Call once after boss.start() during startup. */
export async function registerEmbedDocumentWorker(): Promise<void> {
  await boss.createQueue(EMBED_DOCUMENT_QUEUE);

  await boss.work<EmbedDocumentJobData>(
    EMBED_DOCUMENT_QUEUE,
    async (jobs: Job<EmbedDocumentJobData>[]) => {
      for (const job of jobs) {
        console.info(`[embed-document] Processing job ${job.id}`);
        try {
          await runEmbedDocument(job.data.documentId);
          console.info(`[embed-document] Job ${job.id} completed successfully`);
        } catch (err) {
          console.error(`[embed-document] Job ${job.id} failed:`, err);
          throw err;
        }
      }
    },
  );

  console.log(`[pg-boss] Worker registered for queue: ${EMBED_DOCUMENT_QUEUE}`);
}

// ─── Enqueue helper ───────────────────────────────────────────────────────────

/** `singletonKey` stops two jobs for the same document racing each other's delete-then-insert. */
export async function enqueueEmbedDocument(
  data: EmbedDocumentJobData,
): Promise<string | null> {
  return boss.send(EMBED_DOCUMENT_QUEUE, data, { singletonKey: data.documentId });
}
