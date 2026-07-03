-- Add NEW and PROCESSING to TicketStatus enum
-- Note: ADD VALUE is non-transactional in PostgreSQL, so the default
-- change must be applied after the enum values are committed.

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'NEW' BEFORE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' AFTER 'NEW';

-- Run separately after the above is committed:
-- ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW'::"TicketStatus";
