/**
 * Re-chunks and re-embeds every knowledge document. Use after migrating
 * pre-chunking documents or changing the chunk-size config. Safe against a
 * live database — embed-document replaces a document's chunks in one transaction.
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
