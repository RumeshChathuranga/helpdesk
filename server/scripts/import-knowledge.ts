/**
 * Imports every article in server/knowledge-base/ as a KnowledgeDocument,
 * upserted by title so re-running after an edit updates in place. Each file's
 * first "# " heading becomes the title; the rest becomes the text.
 *
 *   bun run --filter server kb:import
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boss, startBoss } from "../src/lib/boss.js";
import { enqueueEmbedDocument } from "../src/jobs/embed-document.js";
import { prisma } from "../src/lib/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_DIR = path.join(__dirname, "..", "knowledge-base");

function parseArticle(raw: string): { title: string; text: string } {
  const firstLine = raw.split("\n", 1)[0] ?? "";
  const title = firstLine.replace(/^#\s*/, "").trim();
  return { title: title || "Untitled", text: raw.trim() };
}

const files = (await readdir(KB_DIR)).filter((f) => f.endsWith(".md")).sort();

if (files.length === 0) {
  console.log(`[kb:import] No .md files found in ${KB_DIR}`);
} else {
  await startBoss();

  let queued = 0;
  for (const file of files) {
    const raw = await readFile(path.join(KB_DIR, file), "utf-8");
    const { title, text } = parseArticle(raw);

    const existing = await prisma.knowledgeDocument.findFirst({
      where: { title },
      select: { id: true, text: true },
    });

    let documentId: string;
    if (existing) {
      if (existing.text === text) {
        console.log(`[kb:import] ${file} — "${title}" unchanged, skipping`);
        continue;
      }
      await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { text, status: "PENDING", error: null },
      });
      documentId = existing.id;
      console.log(`[kb:import] ${file} — updated "${title}"`);
    } else {
      const created = await prisma.knowledgeDocument.create({
        data: { title, text },
        select: { id: true },
      });
      documentId = created.id;
      console.log(`[kb:import] ${file} — created "${title}"`);
    }

    await enqueueEmbedDocument({ documentId });
    queued++;
  }

  console.log(
    `[kb:import] Queued ${queued} document(s). The running server's embed-document worker will process them.`,
  );
  await boss.stop();
}

await prisma.$disconnect();
