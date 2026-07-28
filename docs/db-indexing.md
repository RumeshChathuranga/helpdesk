# DB indexing notes

Reference for index decisions on the hot tables, and the `pg_trgm` evaluation
flagged in [TASKS.md](../TASKS.md). Update this file when the answer changes,
rather than re-litigating the analysis from scratch.

## Current indexes and what serves what

| Index | Serves |
|---|---|
| `Ticket(status, createdAt)` | `GET /api/tickets?status=X` — filter + default sort in one ordered scan |
| `Ticket(createdAt)` | `GET /api/tickets` with no status filter (the default agent list view) |
| `Ticket(category)` | `?category=X` filtering |
| `Ticket(assignedToId)` | assignment lookups |
| `Ticket(externalMessageId)` (unique) | inbound-email threading match |
| `Reply(externalMessageId)` | reply-level threading match |
| `Reply(deliveryState)` | `sendEmail` job's claim query |
| `Reply(ticketId, approval)` | pending-approval lookups per ticket |

`(status, createdAt)` replaced a plain `Ticket(status)` index — the composite's
leading column serves every query the single-column index did (including the
[sweepStaleTickets](../server/src/jobs/sweepStaleTickets.ts) stale-ticket sweep
and the `get_dashboard_stats()` counts), so keeping both would just be a second
index paying write cost for nothing.

**Verified against a 50k-row synthetic dataset** (`EXPLAIN ANALYZE` on the test
DB, statuses spread across all four values): the default (no status filter)
list query does an `Index Scan Backward using Ticket_createdAt_idx` with no
`Sort` node. The status-filtered query plans an `Index Scan Backward using
Ticket_createdAt_idx` with a residual `Filter` when `createdAt` alone is cheap
enough (status was ~25% selective in the synthetic data); with that index
hidden, the planner falls back to `Index Scan Backward using
Ticket_status_createdAt_idx` with an `Index Cond` — confirming the composite
is there and usable once selectivity or table shape favors it. Neither path
sorts the full table.

## `pg_trgm` for search — evaluated, deferred

[`buildTicketSearchWhere`](../server/src/routes/tickets.ts) emits
`ILIKE '%term%'` across `subject`, `body`, `fromEmail`, `fromName`. A leading
wildcard makes **any** btree index unusable — this is a seq scan by
construction, and no amount of btree work changes that.

**The fix, when it's needed:** `CREATE EXTENSION pg_trgm` plus
`USING GIN (col gin_trgm_ops)` on the four search columns. Prisma can declare
this as `@@index([subject(ops: raw("gin_trgm_ops"))], type: Gin)` so schema and
DB stay in sync. The query itself needs no change — `ILIKE` picks up a trigram
GIN index transparently.

**Why not now:**
- `Ticket.body` allows up to 50,000 characters
  ([fieldLimits.ts](../packages/core/src/fieldLimits.ts)). A trigram GIN index
  over it can exceed the size of the underlying column data, and
  `processTicket` writes each ticket multiple times as it moves through the
  pipeline — that's real, recurring write cost for a table that isn't large
  enough yet to need it.
- The current ticket volume doesn't come close to making the seq scan a
  measurable problem.

**Known limitation to plan around when this ships:** trigram matching needs
at least 3 characters to extract a trigram. The search field accepts 1–2
character queries ([listTicketsQuerySchema](../packages/core/src/listTickets.ts)),
and those will still seq-scan even with the extension enabled — not a
regression, just a gap worth knowing about ahead of time.

**Trigger to revisit:** `Ticket` exceeds ~100k rows, or a production-scale
`EXPLAIN ANALYZE` on the search query exceeds ~200ms. Suggested rollout order
when that happens: `subject`, `fromEmail`, `fromName` first (cheap, covers
most real agent searches), `body` only if search recall genuinely demands it.

**Alternative worth naming:** a stored `tsvector` + GIN full-text index is
cheaper to maintain than trigram over `body`, but changes match semantics from
substring to word-stem — that's a product decision (does "20% off" need to
match "discount"?), not a drop-in performance swap.

## Explicit non-goal, logged as follow-up

`KnowledgeChunk.embedding` has **no vector index** — the RAG cosine search in
[processTicket.ts](../server/src/jobs/processTicket.ts) does a full scan of
every knowledge chunk on every ticket. Fine at current (seed-data) KB size;
wants an HNSW index (`vector_cosine_ops`) once the knowledge base grows past a
trivial number of chunks. Out of scope for this pass — noted here so it isn't
lost.
