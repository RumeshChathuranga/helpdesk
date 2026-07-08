import { boss, startBoss } from "./src/lib/boss.js";
import { enqueueEmbedDocument } from "./src/jobs/embed-document.js";
import { registerEmbedDocumentWorker, EMBED_DOCUMENT_QUEUE } from "./src/jobs/embed-document.js";
import { prisma } from "./src/lib/prisma.js";

async function run() {
  console.log("Starting test script...");
  await startBoss();
  await registerEmbedDocumentWorker();
  
  console.log("Enqueueing embed-document job...");
  const jobId = await enqueueEmbedDocument({ text: "This is a sample text for vectorization." });
  console.log(`Job enqueued with ID: ${jobId}`);

  console.log("Waiting for job to complete...");
  
  // Wait for job completion state in boss
  return new Promise<void>((resolve, reject) => {
    // Check every second if job is completed
    const interval = setInterval(async () => {
      try {
        const count = await prisma.$queryRaw`SELECT count(*) FROM "KnowledgeChunk"`;
        const c = Number((count as any)[0].count);
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
