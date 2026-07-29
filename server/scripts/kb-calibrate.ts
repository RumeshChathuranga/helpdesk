/**
 * Read-only calibration check: embeds a sample of representative ticket
 * texts and reports the best cosine similarity each one gets against the
 * live KnowledgeChunk table, alongside the current RAG_SIMILARITY_THRESHOLD
 * safety gate (server/src/config.ts). Run after importing/re-embedding the
 * knowledge base to see whether the corpus actually clears the gate for
 * realistic tickets, instead of guessing.
 *
 * This does not change the threshold or write anything — see
 * docs/knowledge-base.md for what to do with the result.
 *
 *   bun run --filter server kb:calibrate
 */
import { buildTicketFixtures } from "../prisma/ticketFixtures.js";
import { embedText } from "../src/lib/embeddings.js";
import { prisma } from "../src/lib/prisma.js";
import { RAG_SIMILARITY_THRESHOLD } from "../src/config.js";

const SAMPLE_SIZE = 15;

const chunkCount = await prisma.knowledgeChunk.count();
if (chunkCount === 0) {
  console.log("[kb:calibrate] No KnowledgeChunk rows found — run `bun run --filter server kb:import` first, and wait for the embed-document worker to finish.");
  await prisma.$disconnect();
  process.exit(0);
}

const sample = buildTicketFixtures(SAMPLE_SIZE);
const maxSimilarities: number[] = [];

console.log(`[kb:calibrate] ${chunkCount} chunk(s) in the knowledge base. Threshold: ${RAG_SIMILARITY_THRESHOLD}.\n`);

for (const ticket of sample) {
  const query = `Subject: ${ticket.subject}\n\nBody:\n${ticket.body}`;
  const { vectorString } = await embedText(query);

  const rows = await prisma.$queryRaw<{ maxsim: number | null }[]>`
    SELECT MAX(1 - (embedding <=> ${vectorString}::vector)) AS maxsim
    FROM "KnowledgeChunk"
  `;
  const maxSim = rows[0]?.maxsim ?? 0;
  maxSimilarities.push(maxSim);

  const clears = maxSim >= RAG_SIMILARITY_THRESHOLD ? "✓ clears" : "✗ below";
  console.log(`${clears}  ${maxSim.toFixed(3)}  ${ticket.subject}`);
}

const sorted = [...maxSimilarities].sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
const median =
  sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
const clearedCount = maxSimilarities.filter((s) => s >= RAG_SIMILARITY_THRESHOLD).length;

console.log(`\n[kb:calibrate] Median max-similarity: ${median.toFixed(3)} (threshold ${RAG_SIMILARITY_THRESHOLD})`);
console.log(`[kb:calibrate] ${clearedCount}/${sample.length} sample tickets would clear the gate and attempt a resolution.`);

if (median < RAG_SIMILARITY_THRESHOLD && median >= 0.68) {
  console.log(
    "[kb:calibrate] Median sits in 0.68–0.74 — per docs/knowledge-base.md, this is the one case where lowering RAG_SIMILARITY_THRESHOLD to 0.70 is a documented, data-derived call rather than a silent override. Update config.ts, .env.example, and docs/knowledge-base.md together if you do.",
  );
} else if (median < 0.68) {
  console.log(
    "[kb:calibrate] Median is well below the threshold — the fix is a richer/better-shaped knowledge base, not a lower threshold. See server/knowledge-base/90-supplementary-draft-unverified.md.",
  );
}

await prisma.$disconnect();
