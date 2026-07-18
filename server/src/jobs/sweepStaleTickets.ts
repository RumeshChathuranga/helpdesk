import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";

// ─── Job contract ─────────────────────────────────────────────────────────────

export const SWEEP_STALE_TICKETS_QUEUE = "sweep-stale-tickets" as const;

/** Tickets stuck in NEW/PROCESSING longer than this are considered abandoned. */
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

/** Run every 10 minutes. */
const SWEEP_CRON = "*/10 * * * *";

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Registers and schedules the sweep-stale-tickets worker with pg-boss.
 *
 * Safety net for B1a/B1b: if a ticket somehow ends up stuck in NEW/PROCESSING
 * (e.g. the process crashed between the PROCESSING update and the final update,
 * or pg-boss exhausted its retries) it is otherwise invisible forever, since the
 * agent-facing list excludes NEW/PROCESSING. This sweep periodically flips any
 * such stale tickets to OPEN so they always resurface.
 *
 * Must be called once after boss.start() during server startup.
 */
export async function registerSweepStaleTicketsWorker(): Promise<void> {
  await boss.createQueue(SWEEP_STALE_TICKETS_QUEUE);

  await boss.work(SWEEP_STALE_TICKETS_QUEUE, async () => {
    await sweepStaleTickets();
  });

  await boss.schedule(SWEEP_STALE_TICKETS_QUEUE, SWEEP_CRON, {});

  console.log(
    `[pg-boss] Worker registered + scheduled (${SWEEP_CRON}) for queue: ${SWEEP_STALE_TICKETS_QUEUE}`,
  );
}

/**
 * Flips tickets stuck in NEW/PROCESSING for longer than STALE_THRESHOLD_MS to OPEN,
 * unassigning them if still assigned to the AI agent.
 */
export async function sweepStaleTickets(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Capture the exact set of stale tickets up front — Ticket.updatedAt is an
  // @updatedAt column, so re-filtering on it after an intermediate write would
  // miss rows already touched by the unassign step below.
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

  const aiAgent = await prisma.user.findUnique({ where: { email: "ai@example.com" } });
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

  console.info(
    `[sweep-stale-tickets] Swept ${staleIds.length} stale ticket(s) (stuck > ${STALE_THRESHOLD_MS / 60000}min) to OPEN`,
  );
}
