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
 * Hybrid knowledge retrieval for the ticket pipeline.
 *
 * Two independent searches run over KnowledgeChunk and are fused by rank:
 *
 * - **Dense** — pgvector cosine nearest neighbours. Good at paraphrase and
 *   intent ("I can't get in" -> "password reset"), blind to rare literal tokens.
 * - **Lexical** — Postgres full-text search. Good at exactly the tokens dense
 *   retrieval loses: error codes, SKUs, product names, acronyms like "SSO".
 *
 * Results are combined with Reciprocal Rank Fusion, which needs no score
 * normalisation between the two incomparable scales (cosine vs ts_rank_cd).
 * The winning chunks are then expanded to their immediate neighbours so the
 * model reads whole passages rather than clipped fragments.
 */

/** RRF damping constant. 60 is the value from the original Cormack et al. paper. */
const RRF_K = 60;

/** Lexical-only hits must still be semantically in the neighbourhood, so a
 *  keyword coincidence cannot drag unrelated text into the prompt. */
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
 * Dense candidates.
 *
 * The inner query's `ORDER BY embedding <=> $vec LIMIT n` is the only form
 * pgvector can serve from the HNSW index — ordering by a `1 - (...)` alias
 * (as this code did before chunking landed) forces a full scan of every chunk.
 * Similarity is computed in the outer query, where it costs nothing.
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
 * Lexical candidates.
 *
 * `to_tsvector('english', text)` must match the expression index created in
 * migration 20260728120000 verbatim or Postgres falls back to a seq scan.
 * `websearch_to_tsquery` (rather than `to_tsquery`) because the terms come from
 * customer-authored text and it never raises on malformed input.
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

/**
 * Pulls each selected chunk's immediate neighbours so the prompt sees a
 * continuous passage. Small chunks make retrieval precise; expansion gives the
 * model back the context those small chunks cut away.
 */
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

/**
 * Retrieves knowledge relevant to `query`.
 *
 * Returns an empty context when nothing clears the similarity gate — callers
 * must treat that as "the knowledge base does not cover this" and escalate.
 */
export async function retrieveKnowledge(query: string): Promise<RetrievedContext> {
  const { vectorString } = await embedText(query);

  const dense = await denseCandidates(vectorString);
  const lexical = RAG_HYBRID_SEARCH ? await lexicalCandidates(vectorString, query) : [];

  const fused = fuse(lexical.length > 0 ? [dense, lexical] : [dense]);

  // Safety gate: the AI may only attempt a resolution when at least one chunk is
  // a strong semantic match. Below the threshold the ticket belongs to a human.
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
