import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";
import { AI_AGENT_EMAIL } from "../config.js";
import { childLogger } from "../lib/logger.js";
import { staleTicketsSwept } from "../lib/metrics.js";

const log = childLogger("sweep-stale-tickets");

// ─── Job contract ─────────────────────────────────────────────────────────────

export const SWEEP_STALE_TICKETS_QUEUE = "sweep-stale-tickets" as const;

/** Tickets stuck in NEW/PROCESSING longer than this are considered abandoned. */
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

/** Run every 10 minutes. */
const SWEEP_CRON = "*/10 * * * *";

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Safety net: a ticket stuck in NEW/PROCESSING (crashed mid-update, exhausted
 * retries) is invisible forever since the agent list excludes those statuses.
 * This periodically flips stale ones to OPEN. Call once after boss.start().
 */
export async function registerSweepStaleTicketsWorker(): Promise<void> {
  await boss.createQueue(SWEEP_STALE_TICKETS_QUEUE);

  await boss.work(SWEEP_STALE_TICKETS_QUEUE, async () => {
    await sweepStaleTickets();
  });

  await boss.schedule(SWEEP_STALE_TICKETS_QUEUE, SWEEP_CRON, {});

  log.info({ queue: SWEEP_STALE_TICKETS_QUEUE, cron: SWEEP_CRON }, "worker registered + scheduled");
}

/** Flips tickets stale past STALE_THRESHOLD_MS to OPEN, unassigning the AI agent. */
export async function sweepStaleTickets(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Capture the set up front — updatedAt is an @updatedAt column, so
  // re-filtering after the unassign write below would miss touched rows.
  const staleTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["NEW", "PROCESSING"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, assignedToId: true },
  });

  if (staleTickets.length === 0) {
    return;
  }

  const staleIds = staleTickets.map((t) => t.id);

  const aiAgent = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL } });
  if (!aiAgent) {
    log.warn(
      { aiAgentEmail: AI_AGENT_EMAIL },
      "AI agent user not found — skipping AI-assignee unassign step",
    );
  }
  const aiAssignedIds = aiAgent
    ? staleTickets.filter((t) => t.assignedToId === aiAgent.id).map((t) => t.id)
    : [];

  if (aiAssignedIds.length > 0) {
    await prisma.ticket.updateMany({
      where: { id: { in: aiAssignedIds } },
      data: { assignedToId: null },
    });
  }

  await prisma.ticket.updateMany({
    where: { id: { in: staleIds } },
    data: { status: "OPEN" },
  });

  // Alerted on rather than graphed: this counter moving at all means a ticket
  // escaped the primary pipeline, which is a bug, not a workload characteristic.
  staleTicketsSwept.inc(staleIds.length);

  log.warn(
    { swept: staleIds.length, thresholdMinutes: STALE_THRESHOLD_MS / 60000 },
    "swept stale tickets to OPEN",
  );
}
