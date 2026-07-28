# Knowledge base & RAG

How admin-authored articles become the context the AI uses to resolve
tickets: chunking, embedding, hybrid retrieval, and the operational knobs.
See [docs/db-indexing.md](db-indexing.md) for the index-level detail behind
the retrieval query.

## Data model

```
KnowledgeDocument  (id, title, text, status, error, chunkCount, timestamps)
  └─ KnowledgeChunk[]  (id, documentId, chunkIndex, text, embedding, createdAt)
```

An admin creates a `KnowledgeDocument` — the full article, titled, listed,
searched, and deleted as a unit. The `embed-document` job splits its `text`
into `KnowledgeChunk` rows, one per retrievable passage. Deleting a document
cascades its chunks. `status` tracks the async pipeline: `PENDING` →
`PROCESSING` → `READY` (or `FAILED`, with `error` set).

`KnowledgeChunk.embedding` is `Unsupported("vector(384)")` in
[schema.prisma](../server/prisma/schema.prisma) — Prisma Client cannot read
or write it, so every chunk write and the retrieval query go through
`$queryRaw`/`$executeRaw`. `KnowledgeDocument` has no such column and is
fully Prisma-managed.

## Pipeline: document → chunks → embeddings

1. `POST /api/knowledge` creates the `KnowledgeDocument` synchronously
   (`PENDING`) and enqueues `embed-document` with `{ documentId }` — the row
   exists immediately, so the admin UI can show it before the worker runs.
2. [runEmbedDocument](../server/src/jobs/embed-document.ts) marks the
   document `PROCESSING`, splits `text` with
   [chunkText](../server/src/lib/chunkText.ts), embeds every chunk with
   [embedTexts](../server/src/lib/embeddings.ts), and — inside one
   transaction — replaces the document's chunk rows and marks it `READY`
   with the resulting `chunkCount`. Delete-then-insert makes a pg-boss retry
   idempotent instead of duplicating chunks.
3. On failure the document is marked `FAILED` with a truncated `error`, and
   the job rethrows so pg-boss retries it.

### Why chunking, specifically

The embedding model, `Xenova/all-MiniLM-L6-v2`
([embeddings.ts](../server/src/lib/embeddings.ts)), has a **256-token
context window**. Before chunking, one document was one row embedded
whole — anything past ~180 words was silently truncated by the tokenizer at
embed time. The text was stored in full but only its opening section was
ever retrievable.

[chunkText](../server/src/lib/chunkText.ts) splits structurally —
paragraphs, then sentences, then words, then (for a single oversized token
like a URL) characters — packing greedily up to `KB_CHUNK_MAX_TOKENS` (200,
comfortably under the 256-token window). Each new chunk is seeded with the
tail of the previous one, up to `KB_CHUNK_OVERLAP_TOKENS` (40), so an answer
sitting across a chunk boundary is still whole in at least one chunk. A
trailing chunk under the minimum size is folded back into its predecessor
rather than embedded as a meaningless fragment.

It's pure and synchronous, with the token counter injected — tests use a
cheap word-count stub ([chunkText.test.ts](../server/src/lib/chunkText.test.ts)),
while the job calls
[getTokenCounter](../server/src/lib/embeddings.ts) to measure with the
model's own tokenizer, so chunk sizing matches the units the model actually
truncates on.

## Retrieval: hybrid search + neighbour expansion

[retrieveKnowledge.ts](../server/src/lib/retrieveKnowledge.ts) is called
from [processTicket.ts](../server/src/jobs/processTicket.ts) with the
ticket's subject + body. It runs two independent searches and fuses them:

- **Dense (semantic):** pgvector cosine nearest-neighbours, HNSW-indexed.
  Good at paraphrase and intent — "I can't get in" finds a passage about
  password resets even without a shared word. Blind to rare literal tokens
  it's never seen phrased that way.
- **Lexical (keyword):** Postgres full-text search
  (`websearch_to_tsquery` against a `to_tsvector('english', text)` GIN
  index). Good at exactly what dense retrieval misses — error codes, SKUs,
  product names, acronyms like "SSO" — because it matches tokens directly
  rather than through a learned embedding.

Results are combined with **Reciprocal Rank Fusion**:
`score(chunk) = Σ 1 / (60 + rank_in_list)` across whichever lists the chunk
appears in. RRF needs no score normalization between cosine similarity and
`ts_rank_cd` — two scales that aren't otherwise comparable — which is why
it's the standard choice for fusing heterogeneous rankers.

**Example.** A ticket mentions "error E4021 won't clear." The dense arm
ranks a generic troubleshooting passage highest (it talks about the same
concepts) but never surfaces the passage that literally lists `E4021`,
because the embedding has no special affinity for an arbitrary code. The
lexical arm ranks the `E4021` passage first on an exact match. RRF gives
that passage a strong combined score from appearing near the top of one list
even though it's mid-pack (or absent) from the other — which is exactly the
case a single-signal search would miss.

**Safety gate.** At least one fused chunk must clear
`RAG_SIMILARITY_THRESHOLD` (0.75 cosine similarity) or `retrieveKnowledge`
returns an empty context, and `processTicket` escalates the ticket to a
human — unchanged from the pre-hybrid behavior. This is a floor, not a
tuning knob: raising it makes the AI more conservative, lowering it lets
weaker matches through. A chunk that only cleared via the lexical arm still
has to pass a relaxed `KEYWORD_MIN_SIMILARITY` floor (0.4) before entering
the prompt, so an unrelated keyword coincidence can't inject irrelevant text.

**Neighbour expansion.** Small chunks make *retrieval* precise but hand the
model a clipped fragment. For each selected chunk, `retrieveKnowledge` also
pulls `chunkIndex - 1` and `chunkIndex + 1` from the same document, so the
model reads a continuous passage. Sections are grouped by document (titled
with `### <title>`) and assembled up to `RAG_CONTEXT_CHAR_BUDGET` (6000
characters) so the system prompt stays bounded regardless of how much
expansion pulls in.

## Configuration

All in [server/src/config.ts](../server/src/config.ts), env-overridable,
following the repo convention of reading `process.env` once at startup
rather than scattering reads through feature code.

| Variable | Default | What it controls |
|---|---|---|
| `KB_CHUNK_MAX_TOKENS` | 200 | Chunk size ceiling. Must stay under the model's 256-token window. |
| `KB_CHUNK_OVERLAP_TOKENS` | 40 | Tokens repeated between adjacent chunks. |
| `RAG_TOP_K` | 3 | Chunks handed to the resolution prompt after fusion. |
| `RAG_CANDIDATE_POOL` | 20 | Per-arm candidate count fed into fusion (recall vs. work). |
| `RAG_SIMILARITY_THRESHOLD` | 0.75 | Safety gate — minimum cosine similarity to attempt a resolution at all. |
| `RAG_CONTEXT_CHAR_BUDGET` | 6000 | Character cap on the assembled prompt context. |
| `RAG_HYBRID_SEARCH` | `true` | Set `false` to fall back to pure dense retrieval. |

## Operations

- **Re-embedding existing documents:** `bun run --filter server kb:reembed`
  ([reembed-knowledge.ts](../server/scripts/reembed-knowledge.ts)) re-queues
  every `KnowledgeDocument` through `embed-document`. Needed after migrating
  documents created before chunking existed (they land as a single
  truncated chunk) or after changing `KB_CHUNK_MAX_TOKENS` /
  `KB_CHUNK_OVERLAP_TOKENS`.
- **`FAILED` documents:** the job caught an error mid-embedding (e.g. the
  model pipeline failed to load) and recorded it in
  `KnowledgeDocument.error`. Re-run `kb:reembed`, or delete and re-add the
  document, once the underlying issue is fixed. pg-boss also retries the job
  automatically before it's visible as failed in the UI.
- **API:** `GET /api/knowledge` (paginated, `page`/`pageSize`/`search`/`status`,
  list rows omit `text`), `GET /api/knowledge/:id` (full document + chunks),
  `POST /api/knowledge` (`title` + `text`, 201 with the `PENDING` document),
  `DELETE /api/knowledge/:id`. All `requireAdmin`. Schemas live in
  [packages/core/src/knowledge.ts](../packages/core/src/knowledge.ts).
