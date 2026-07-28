-- Knowledge base: parent documents, chunked children, and the two indexes that
-- make RAG retrieval index-backed instead of a full scan.
--
-- Before this migration one POST = one KnowledgeChunk row holding the entire
-- pasted text. The embedding model (Xenova/all-MiniLM-L6-v2) has a 256-token
-- window, so anything longer was silently truncated at embed time: the text was
-- stored in full but only its first ~180 words were retrievable.
--
-- KnowledgeDocument is the unit an admin creates, titles, lists and deletes.
-- KnowledgeChunk becomes the unit that gets embedded and retrieved, sized to
-- fit the model window with overlap. Chunks cascade with their document.
--
-- Existing rows are preserved as one-chunk documents. Run
-- `bun run --filter server kb:reembed` afterwards to re-chunk them properly.

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_createdAt_idx" ON "KnowledgeDocument"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- Backfill: one document per existing chunk, reusing the chunk's id as the
-- document id so the link in the next step needs no lookup table. Titles are
-- derived from the leading text since the old API had no title field.
INSERT INTO "KnowledgeDocument" ("id", "title", "text", "status", "chunkCount", "createdAt", "updatedAt")
SELECT
    "id",
    left(regexp_replace("text", '\s+', ' ', 'g'), 80),
    "text",
    'READY',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "KnowledgeChunk";

-- AlterTable — added nullable/defaulted first so the backfill below can run.
ALTER TABLE "KnowledgeChunk"
    ADD COLUMN "documentId" TEXT,
    ADD COLUMN "chunkIndex" INTEGER,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "KnowledgeChunk" SET "documentId" = "id", "chunkIndex" = 0;

ALTER TABLE "KnowledgeChunk"
    ALTER COLUMN "documentId" SET NOT NULL,
    ALTER COLUMN "chunkIndex" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- Dense retrieval index. pgvector can only use this for an ORDER BY on the raw
-- distance operator (`ORDER BY embedding <=> $1 LIMIT k`) — the old query
-- ordered by a `1 - (embedding <=> $1)` alias, which no index can serve. See
-- lib/retrieveKnowledge.ts, which issues the index-usable form.
CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
    ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);

-- Lexical retrieval index for the hybrid search's keyword arm. An expression
-- index rather than a generated tsvector column: it keeps the datamodel free of
-- an Unsupported("tsvector") field. Postgres only uses it when a query repeats
-- this expression verbatim, so retrieveKnowledge.ts must keep matching it.
CREATE INDEX "KnowledgeChunk_text_fts_idx"
    ON "KnowledgeChunk" USING GIN (to_tsvector('english', "text"));
