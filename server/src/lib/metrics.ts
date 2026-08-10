import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { APP_ROLE, METRICS_QUEUE_POLL_MS } from "../config.js";
import { boss } from "./boss.js";
import { childLogger } from "./logger.js";

const log = childLogger("metrics");

/** Own registry rather than the global default, so a test importing this module
 *  cannot leak metric registrations into another test's snapshot. */
export const registry: Registry = new Registry();

collectDefaultMetrics({ register: registry });

// ─── RED metrics for the HTTP surface ─────────────────────────────────────────

export const httpRequestDuration: Histogram<"method" | "route" | "status_code"> =
  new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests handled by the API",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

// ─── Ticket pipeline ──────────────────────────────────────────────────────────

/** Terminal outcomes of one `process-ticket` run. `awaiting_approval` is not a
 *  failure — it is the email-sourced path where the AI drafted a reply a human
 *  still has to approve, so it must not be counted as an auto-resolution. */
export type TicketOutcome = "resolved" | "awaiting_approval" | "escalated" | "failed";

export const ticketsProcessed: Counter<"outcome"> = new Counter({
  name: "helpdesk_tickets_processed_total",
  help: "Tickets that finished the AI pipeline, by terminal outcome",
  labelNames: ["outcome"],
  registers: [registry],
});

/** Kept separate from the outcome counter on purpose — crossing the two would
 *  give 12 categories x 4 outcomes of mostly-empty series for no question anyone
 *  actually asks. */
export const ticketsClassified: Counter<"category"> = new Counter({
  name: "helpdesk_tickets_classified_total",
  help: "Tickets assigned a category by the classifier",
  labelNames: ["category"],
  registers: [registry],
});

/** Ticket creation → terminal status, so it covers queue wait as well as the
 *  two LLM round trips. Buckets are wide because a cold worker also pays the
 *  MiniLM load. */
export const ticketPipelineDuration: Histogram<"outcome"> = new Histogram({
  name: "helpdesk_ticket_pipeline_duration_seconds",
  help: "Seconds from ticket creation to a terminal pipeline outcome",
  labelNames: ["outcome"],
  buckets: [1, 2.5, 5, 10, 20, 30, 60, 120, 300],
  registers: [registry],
});

export const ragRetrievals: Counter<"result"> = new Counter({
  name: "helpdesk_rag_retrievals_total",
  help: "Knowledge-base retrievals, by whether anything cleared the similarity floor",
  labelNames: ["result"],
  registers: [registry],
});

export const aiProviderErrors: Counter<"operation"> = new Counter({
  name: "helpdesk_ai_provider_errors_total",
  help: "Failed calls to the AI provider, by the operation that was attempted",
  labelNames: ["operation"],
  registers: [registry],
});

/** Any non-zero value means a ticket reached the 15-minute stale cutoff, i.e.
 *  the primary pipeline dropped it. This is an alert, not a dashboard number. */
export const staleTicketsSwept: Counter = new Counter({
  name: "helpdesk_stale_tickets_swept_total",
  help: "Tickets rescued from a stuck NEW/PROCESSING state by the stale sweeper",
  registers: [registry],
});

export const emailsSent: Counter<"outcome"> = new Counter({
  name: "helpdesk_emails_sent_total",
  help: "Outbound reply deliveries attempted, by outcome",
  labelNames: ["outcome"],
  registers: [registry],
});

export const queueDepth: Gauge<"queue" | "state"> = new Gauge({
  name: "helpdesk_pgboss_queue_depth",
  help: "pg-boss jobs per queue by state",
  labelNames: ["queue", "state"],
  registers: [registry],
  collect: refreshQueueDepth,
});

// ─── Zero-initialisation ──────────────────────────────────────────────────────

const TICKET_OUTCOMES: TicketOutcome[] = [
  "resolved",
  "awaiting_approval",
  "escalated",
  "failed",
];

/**
 * A counter that has never been incremented exports no series at all, so
 * `rate(...)` returns nothing and a "no tickets escalated" panel is
 * indistinguishable from "the exporter is broken". Declaring the label sets up
 * front makes zero mean zero.
 */
function initialiseCounters(): void {
  for (const outcome of TICKET_OUTCOMES) ticketsProcessed.inc({ outcome }, 0);
  for (const operation of ["classify", "resolve", "summarize", "polish"]) {
    aiProviderErrors.inc({ operation }, 0);
  }
  for (const result of ["hit", "miss", "error"]) ragRetrievals.inc({ result }, 0);
  for (const outcome of ["sent", "failed", "skipped"]) emailsSent.inc({ outcome }, 0);
  staleTicketsSwept.inc(0);
}

// ─── Queue depth ──────────────────────────────────────────────────────────────

let queueSnapshotAt = 0;

/**
 * Runs on scrape, rate-limited so several scrapers cannot turn a dashboard
 * refresh into a query storm. Skipped on the API role: queue depth is a property
 * of the database, not of a pod, so having every API replica poll it would
 * multiply the query count for an identical answer.
 */
async function refreshQueueDepth(): Promise<void> {
  if (APP_ROLE === "api") return;
  if (Date.now() - queueSnapshotAt < METRICS_QUEUE_POLL_MS) return;
  queueSnapshotAt = Date.now();

  try {
    const queues = await boss.getQueues();
    for (const queue of queues) {
      queueDepth.set({ queue: queue.name, state: "ready" }, queue.readyCount);
      queueDepth.set({ queue: queue.name, state: "active" }, queue.activeCount);
      queueDepth.set({ queue: queue.name, state: "deferred" }, queue.deferredCount);
      queueDepth.set({ queue: queue.name, state: "failed" }, queue.failedCount);
    }
  } catch (err) {
    // A scrape must never fail because the database blipped — Prometheus would
    // mark the target down and hide every other metric this pod exports.
    log.warn({ err }, "queue depth refresh failed, serving the previous snapshot");
  }
}

/** Call once at startup, after boss.start(). */
export function initMetrics(): void {
  initialiseCounters();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seconds between `from` and now, as a Histogram observation. */
export function secondsSince(from: Date): number {
  return (Date.now() - from.getTime()) / 1000;
}

/** Counts a provider failure and rethrows unchanged, so callers that let the
 *  error propagate (the polish/summarize routes) still register it. */
export async function withAiErrorMetric<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    aiProviderErrors.inc({ operation });
    throw err;
  }
}
