-- CreateEnum
CREATE TYPE "ReplyDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ReplyApprovalState" AS ENUM ('NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "EmailDeliveryState" AS ENUM ('NOT_QUEUED', 'QUEUED', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "approval" "ReplyApprovalState" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "deliveryState" "EmailDeliveryState" NOT NULL DEFAULT 'NOT_QUEUED',
ADD COLUMN     "direction" "ReplyDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN     "lastSendAttemptAt" TIMESTAMP(3),
ADD COLUMN     "sendAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "Reply_deliveryState_idx" ON "Reply"("deliveryState");

-- CreateIndex
CREATE INDEX "Reply_ticketId_approval_idx" ON "Reply"("ticketId", "approval");

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill direction: nothing in the system has ever *sent* an email, so any
-- pre-existing reply carrying an externalMessageId can only have been written
-- by createFromInboundEmail — i.e. it is a customer message.
UPDATE "Reply" SET "direction" = 'INBOUND' WHERE "externalMessageId" IS NOT NULL;

-- Backfill deliveryState from the legacy boolean so the two never disagree.
UPDATE "Reply"
SET "deliveryState" = 'SENT', "sentAt" = "createdAt"
WHERE "sentEmail" = true AND "direction" = 'OUTBOUND';
