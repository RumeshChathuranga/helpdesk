-- Rebrand to the CITeS IT Help Desk domain.
--
-- TicketCategory is replaced wholesale, not remapped: none of the old SaaS
-- values (BILLING/FEATURE_REQUEST/BUG/...) has a meaningful university
-- equivalent. Postgres cannot drop values from an enum in use, so the type
-- is rebuilt. Existing tickets are demo fixtures and are wiped rather than
-- remapped (Reply rows cascade via the ticket foreign key). Re-seed with
-- `bun run db:seed` afterwards.

DELETE FROM "Ticket";

-- CreateEnum (new shape)
CREATE TYPE "TicketCategory_new" AS ENUM (
    'ACCOUNT_ACCESS', 'EMAIL', 'NETWORK', 'WIFI_EDUROAM', 'LMS_MOODLE',
    'LEARNORG_MIS', 'ERP_DMS', 'SOFTWARE_LICENSING', 'ZOOM_CONFERENCING',
    'WEB_HOSTING', 'HARDWARE', 'OTHER'
);

-- The column default references the old type, so it must be dropped before
-- the column can be retyped, and restored after.
ALTER TABLE "Ticket" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Ticket"
    ALTER COLUMN "category" TYPE "TicketCategory_new"
    USING ('OTHER'::"TicketCategory_new");
ALTER TABLE "Ticket" ALTER COLUMN "category" SET DEFAULT 'OTHER';

DROP TYPE "TicketCategory";
ALTER TYPE "TicketCategory_new" RENAME TO "TicketCategory";

-- CreateEnum
CREATE TYPE "RequesterType" AS ENUM (
    'STUDENT', 'ACADEMIC_STAFF', 'ACADEMIC_SUPPORT_STAFF',
    'ADMINISTRATIVE_STAFF', 'TECHNICAL_STAFF', 'NON_ACADEMIC_STAFF'
);

-- AlterTable — nullable: inbound-email inference may not identify a
-- requester, and agents can set it later from the ticket detail page.
ALTER TABLE "Ticket" ADD COLUMN "requesterType" "RequesterType";

-- CreateIndex — supports the requesterType list filter added in a later phase.
CREATE INDEX "Ticket_requesterType_idx" ON "Ticket"("requesterType");
