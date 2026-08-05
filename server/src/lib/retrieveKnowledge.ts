import { Prisma } from "@prisma/client";
import {
  RAG_CANDIDATE_POOL,
  RAG_CONTEXT_CHAR_BUDGET,
  RAG_HYBRID_SEARCH,
  RAG_SIMILARITY_THRESHOLD,
  RAG_TOP_K,
} from "../config.js";
import { embedText } from "../lib/embeddings.js";
import { prisma } from "../lib/prisma.js";

/**
 * Hybrid retrieval over KnowledgeChunk: pgvector cosine catches paraphrase,
 * Postgres full-text catches the literal tokens it misses (error codes, "SSO").
 * Fused by Reciprocal Rank Fusion, which needs no normalisation between the two
 * incomparable scales, then expanded to neighbouring chunks.
 */

/** RRF damping constant. 60 is the value from the original Cormack et al. paper. */
const RRF_K = 60;

/** Floor for lexical-only hits, so a keyword coincidence can't reach the prompt. */
const KEYWORD_MIN_SIMILARITY = 0.4;

interface CandidateRow {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

export interface RetrievedChunk extends CandidateRow {
  /** Fused RRF score across the dense and lexical arms. */
  score: number;
}

export interface RetrievedContext {
  /** Prompt-ready knowledge text. Empty when nothing cleared the safety gate. */
  contextText: string;
  chunks: RetrievedChunk[];
}

const EMPTY_CONTEXT: RetrievedContext = { contextText: "", chunks: [] };

/**
 * Dense candidates. The inner `ORDER BY embedding <=> $vec LIMIT n` is the only
 * form pgvector serves from the HNSW index — ordering by a `1 - (...)` alias
 * forces a full scan, so similarity is computed in the outer query.
 */
async function denseCandidates(vectorString: string): Promise<CandidateRow[]> {
  return prisma.$queryRaw<CandidateRow[]>`
    SELECT c.id,
           c."documentId",
           c."chunkIndex",
           c.text,
           1 - (c.embedding <=> ${vectorString}::vector) AS similarity
    FROM (
      SELECT id, "documentId", "chunkIndex", text, embedding
      FROM "KnowledgeChunk"
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${RAG_CANDIDATE_POOL}
    ) c
  `;
}

/**
 * Lexical candidates. `to_tsvector('english', text)` must match the expression
 * index in migration 20260728120000 verbatim or Postgres seq-scans.
 * `websearch_to_tsquery` never raises on the malformed input customers write.
 */
async function lexicalCandidates(
  vectorString: string,
  terms: string,
): Promise<CandidateRow[]> {
  return prisma.$queryRaw<CandidateRow[]>`
    SELECT c.id,
           c."documentId",
           c."chunkIndex",
           c.text,
           1 - (c.embedding <=> ${vectorString}::vector) AS similarity
    FROM "KnowledgeChunk" c,
         websearch_to_tsquery('english', ${terms}) q
    WHERE to_tsvector('english', c.text) @@ q
    ORDER BY ts_rank_cd(to_tsvector('english', c.text), q) DESC
    LIMIT ${RAG_CANDIDATE_POOL}
  `;
}

/** Reciprocal Rank Fusion over any number of ranked candidate lists. */
function fuse(lists: CandidateRow[][]): RetrievedChunk[] {
  const scores = new Map<string, RetrievedChunk>();

  for (const list of lists) {
    list.forEach((row, index) => {
      const contribution = 1 / (RRF_K + index + 1);
      const existing = scores.get(row.id);
      if (existing) {
        existing.score += contribution;
      } else {
        scores.set(row.id, { ...row, score: contribution });
      }
    });
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

/** Pulls each chunk's neighbours back in, so the model reads whole passages
 *  rather than the fragments retrieval matched on. */
async function expandWithNeighbours(
  selected: RetrievedChunk[],
): Promise<Map<string, { title: string; chunks: { chunkIndex: number; text: string }[] }>> {
  const ranges = selected.map(
    (chunk) => Prisma.sql`
      ("documentId" = ${chunk.documentId}
       AND "chunkIndex" BETWEEN ${chunk.chunkIndex - 1} AND ${chunk.chunkIndex + 1})
    `,
  );

  const rows = await prisma.$queryRaw<
    { documentId: string; title: string; chunkIndex: number; text: string }[]
  >`
    SELECT c."documentId", d.title, c."chunkIndex", c.text
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeDocument" d ON d.id = c."documentId"
    WHERE ${Prisma.join(ranges, " OR ")}
    ORDER BY c."documentId", c."chunkIndex"
  `;

  const byDocument = new Map<
    string,
    { title: string; chunks: { chunkIndex: number; text: string }[] }
  >();

  for (const row of rows) {
    const entry = byDocument.get(row.documentId) ?? { title: row.title, chunks: [] };
    entry.chunks.push({ chunkIndex: row.chunkIndex, text: row.text });
    byDocument.set(row.documentId, entry);
  }

  return byDocument;
}

/** Assembles passages into prompt text, stopping at the character budget. */
function assembleContext(
  byDocument: Map<string, { title: string; chunks: { chunkIndex: number; text: string }[] }>,
  documentOrder: string[],
): string {
  const sections: string[] = [];
  let used = 0;

  for (const documentId of documentOrder) {
    const entry = byDocument.get(documentId);
    if (!entry) continue;

    const section = `### ${entry.title}\n${entry.chunks.map((c) => c.text).join("\n")}`;
    if (used + section.length > RAG_CONTEXT_CHAR_BUDGET && sections.length > 0) {
      break;
    }
    sections.push(section.slice(0, RAG_CONTEXT_CHAR_BUDGET));
    used += section.length;
  }

  return sections.join("\n\n---\n\n");
}

/** Empty context means nothing cleared the similarity gate — callers must treat
 *  that as "the KB doesn't cover this" and escalate. */
export async function retrieveKnowledge(query: string): Promise<RetrievedContext> {
  const { vectorString } = await embedText(query);

  const dense = await denseCandidates(vectorString);
  const lexical = RAG_HYBRID_SEARCH ? await lexicalCandidates(vectorString, query) : [];

  const fused = fuse(lexical.length > 0 ? [dense, lexical] : [dense]);

  // Safety gate: without one strong semantic match the ticket belongs to a human.
  const hasStrongMatch = fused.some(
    (chunk) => chunk.similarity >= RAG_SIMILARITY_THRESHOLD,
  );
  if (!hasStrongMatch) {
    return EMPTY_CONTEXT;
  }

  const selected = fused
    .filter(
      (chunk) =>
        chunk.similarity >= RAG_SIMILARITY_THRESHOLD ||
        chunk.similarity >= KEYWORD_MIN_SIMILARITY,
    )
    .slice(0, RAG_TOP_K);

  if (selected.length === 0) {
    return EMPTY_CONTEXT;
  }

  const byDocument = await expandWithNeighbours(selected);

  // Preserve fusion order at the document level so the best match leads.
  const documentOrder: string[] = [];
  for (const chunk of selected) {
    if (!documentOrder.includes(chunk.documentId)) {
      documentOrder.push(chunk.documentId);
    }
  }

  return {
    contextText: assembleContext(byDocument, documentOrder),
    chunks: selected,
  };
}
