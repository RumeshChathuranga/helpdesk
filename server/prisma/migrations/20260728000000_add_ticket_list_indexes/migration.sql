-- The agent ticket list (GET /api/tickets) always filters on status and, by
-- default, orders by createdAt DESC with a small LIMIT. With only a
-- single-column status index the planner had to scan and sort the whole table
-- to return one page.
--
-- Ticket_createdAt_idx serves the default path: status NOT IN (NEW,PROCESSING)
-- is not a usable leading-column predicate, but those states are transient, so
-- a backward scan on createdAt fills LIMIT almost immediately.
--
-- Ticket_status_createdAt_idx serves the filtered path (?status=OPEN) as one
-- ordered range scan. Its leading column makes the old status-only index
-- redundant, so that one is dropped rather than kept alongside.

-- DropIndex
DROP INDEX "Ticket_status_idx";

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");
