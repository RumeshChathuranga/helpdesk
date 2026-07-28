import { boss, startBoss } from "../src/lib/boss.js";
import {
  enqueueEmbedDocument,
  registerEmbedDocumentWorker,
} from "../src/jobs/embed-document.js";
import { prisma } from "../src/lib/prisma.js";

async function run() {
  console.log("Starting test script...");
  await startBoss();
  await registerEmbedDocumentWorker();
  
  console.log("Creating a knowledge document...");
  const document = await prisma.knowledgeDocument.create({
    data: {
      title: "Embedding smoke test",
      text: "This is a sample text for vectorization.",
    },
    select: { id: true },
  });

  console.log("Enqueueing embed-document job...");
  const jobId = await enqueueEmbedDocument({ documentId: document.id });
  console.log(`Job enqueued with ID: ${jobId}`);

  console.log("Waiting for job to complete...");
  
  // Wait for job completion state in boss
  return new Promise<void>((resolve) => {
    // Check every second if job is completed
    const interval = setInterval(async () => {
      try {
        const count = await prisma.$queryRaw<
          { count: bigint }[]
        >`SELECT count(*) FROM "KnowledgeChunk"`;
        const c = Number(count[0].count);
        if (c > 0) {
          console.log(`Number of knowledge chunks in DB: ${c}`);
          clearInterval(interval);
          await boss.stop();
          await prisma.$disconnect();
          console.log("Done.");
          resolve();
        }
      } catch (e) {
        console.error(e);
      }
    }, 1000);
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
