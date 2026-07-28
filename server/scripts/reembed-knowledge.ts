/**
 * Re-chunks and re-embeds every knowledge document.
 *
 * Use after migrating documents that predate chunking (they land as a single
 * truncated chunk), or after changing KB_CHUNK_MAX_TOKENS / KB_CHUNK_OVERLAP_TOKENS.
 * The embed-document job replaces a document's chunks in one transaction, so
 * this is safe to run against a live database.
 *
 *   bun run --filter server kb:reembed
 */
import { boss, startBoss } from "../src/lib/boss.js";
import { enqueueEmbedDocument } from "../src/jobs/embed-document.js";
import { prisma } from "../src/lib/prisma.js";

const documents = await prisma.knowledgeDocument.findMany({
  select: { id: true, title: true },
  orderBy: { createdAt: "asc" },
});

if (documents.length === 0) {
  console.log("[kb:reembed] No knowledge documents found.");
} else {
  await startBoss();

  for (const document of documents) {
    await enqueueEmbedDocument({ documentId: document.id });
    console.log(`[kb:reembed] Queued ${document.id} — ${document.title}`);
  }

  console.log(
    `[kb:reembed] Queued ${documents.length} document(s). The running server's embed-document worker will process them.`,
  );
  await boss.stop();
}

await prisma.$disconnect();
