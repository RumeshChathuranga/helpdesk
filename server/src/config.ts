// ─── Process role ─────────────────────────────────────────────────────────────

export type AppRole = "all" | "api" | "worker";

/** "all" (default) runs API + every worker in one process. "api"/"worker" split
 *  across containers so AI throughput scales independently of HTTP capacity. */
function readAppRole(): AppRole {
  const raw = process.env.APP_ROLE ?? "all";
  if (raw !== "all" && raw !== "api" && raw !== "worker") {
    // The one place console survives: the pino logger reads APP_ROLE and
    // LOG_LEVEL from this module, so importing it here would be circular.
    console.error(`FATAL: APP_ROLE must be one of all|api|worker (got ${JSON.stringify(raw)})`);
    process.exit(1);
  }
  return raw;
}
export const APP_ROLE: AppRole = readAppRole();

// ─── Logging ──────────────────────────────────────────────────────────────────

/** pino level. "debug" locally is fine; in a cluster it multiplies Loki volume.
 *  Tests drop to "warn" so a failing assertion isn't buried under pipeline chatter. */
function defaultLogLevel(): string {
  switch (process.env.NODE_ENV) {
    case "production":
      return "info";
    case "test":
      return "warn";
    default:
      return "debug";
  }
}
export const LOG_LEVEL = process.env.LOG_LEVEL ?? defaultLogLevel();

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** Off in tests by default — a scrape listener per test file would fight for ports. */
export const METRICS_ENABLED =
  (process.env.METRICS_ENABLED ?? (process.env.NODE_ENV === "test" ? "false" : "true")) ===
  "true";

/** Deliberately a second listener on its own port: the Ingress only routes the
 *  API port, so /metrics is unreachable from the internet without an authn layer
 *  we would otherwise have to build. It also gives the worker — which serves no
 *  API — a scrape target. */
export const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9464);

/** How often the pg-boss queue-depth gauge may hit the database. The scrape
 *  interval is 30s, so this only matters if several Prometheus replicas scrape. */
export const METRICS_QUEUE_POLL_MS = Number(process.env.METRICS_QUEUE_POLL_MS ?? 15000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

/** Delay between flipping readiness to 503 and closing the listener, so a load
 *  balancer has time to stop routing before the socket closes. */
export const SHUTDOWN_DRAIN_MS = Number(
  process.env.SHUTDOWN_DRAIN_MS ?? (process.env.NODE_ENV === "production" ? 5000 : 0),
);

/** Ceiling on how long pg-boss waits for in-flight jobs to finish during
 *  shutdown before forcing the connection pool closed. */
export const SHUTDOWN_JOB_TIMEOUT_MS = Number(process.env.SHUTDOWN_JOB_TIMEOUT_MS ?? 25000);

/** Watchdog for the whole shutdown sequence — if it hasn't exited by then,
 *  something is stuck, so force-exit(1) rather than hang until SIGKILL. */
export const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 30000);

// ─── Embedding model ──────────────────────────────────────────────────────────

/** Directory transformers.js caches weights in. Unset keeps the library default
 *  (dev); the release image points this at the path baked in at build time. */
export const MODEL_CACHE_DIR = process.env.MODEL_CACHE_DIR;

/** Whether transformers.js may download from the HF Hub. False in the release
 *  image, so a missing baked model fails loudly instead of paying 87 MB per deploy. */
export const ALLOW_REMOTE_MODELS = (process.env.ALLOW_REMOTE_MODELS ?? "true") === "true";

/** AI agent's user account email — must match a seeded User row for auto-assignment to work. */
export const AI_AGENT_EMAIL = process.env.AI_AGENT_EMAIL ?? "ai@cites.uom.lk";

/** From-name/sign-off email used in AI-polished agent replies. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "cites@uom.lk";

/** Product/brand name surfaced in AI system prompts. */
export const BRAND_NAME = process.env.BRAND_NAME ?? "University of Moratuwa — CITeS IT Help Desk";

/** Chat model used for classification, RAG replies, summaries, and reply polishing. */
export const AI_MODEL = process.env.AI_MODEL ?? "o4-mini";

/** OpenAI-compatible endpoint serving AI_MODEL. */
export const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://models.inference.ai.azure.com";

/** Outbound email adapter selection. Defaults to a no-op logger everywhere
 *  except production, so dev/test/CI can never open a socket to a real
 *  mail provider by accident. */
export const EMAIL_DRIVER =
  process.env.EMAIL_DRIVER ?? (process.env.NODE_ENV === "production" ? "smtp" : "log");

/** Envelope/header From address for outbound mail. For the Gmail SMTP driver
 *  this must equal SMTP_USER (or a verified "Send mail as" alias), or Gmail
 *  silently rewrites the From header. */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? SUPPORT_EMAIL;

/** Display name shown alongside EMAIL_FROM. */
export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? BRAND_NAME;

/** Reply-To header — where customer replies should land. */
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO ?? EMAIL_FROM;

/** Right-hand side of generated outbound Message-IDs. */
export const EMAIL_MESSAGE_ID_DOMAIN =
  process.env.EMAIL_MESSAGE_ID_DOMAIN ?? EMAIL_FROM.split("@")[1] ?? "helpdesk.uom.lk";

export const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
export const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
export const SMTP_SECURE = (process.env.SMTP_SECURE ?? "true") === "true";
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

// ─── Knowledge base chunking ──────────────────────────────────────────────────

/** Target size of a knowledge chunk. Xenova/all-MiniLM-L6-v2 truncates at 256
 *  tokens, so this stays below it with headroom for the [CLS]/[SEP] specials —
 *  anything larger would be silently cut off at embed time. */
export const KB_CHUNK_MAX_TOKENS = Number(process.env.KB_CHUNK_MAX_TOKENS ?? 200);

/** Tokens repeated from the tail of the previous chunk into the next one, so an
 *  answer that straddles a chunk boundary is still fully present in one chunk. */
export const KB_CHUNK_OVERLAP_TOKENS = Number(
  process.env.KB_CHUNK_OVERLAP_TOKENS ?? 40,
);

// ─── RAG retrieval ────────────────────────────────────────────────────────────

/** Chunks handed to the resolution prompt after fusion. */
export const RAG_TOP_K = Number(process.env.RAG_TOP_K ?? 3);

/** Per-arm candidate pool fed into rank fusion. Larger = better recall, more
 *  work; it only affects the fusion input, not the prompt size. */
export const RAG_CANDIDATE_POOL = Number(process.env.RAG_CANDIDATE_POOL ?? 20);

/** Cosine-similarity floor a ticket must clear on at least one chunk before the
 *  AI is allowed to attempt a resolution. Below it the ticket escalates to a
 *  human — this is a safety gate, not a tuning knob; raise it, don't lower it. */
export const RAG_SIMILARITY_THRESHOLD = Number(
  process.env.RAG_SIMILARITY_THRESHOLD ?? 0.75,
);

/** Character budget for the assembled knowledge context, so neighbour expansion
 *  cannot grow the system prompt without bound. */
export const RAG_CONTEXT_CHAR_BUDGET = Number(
  process.env.RAG_CONTEXT_CHAR_BUDGET ?? 6000,
);

/** Whether to run the lexical (Postgres full-text) arm alongside the vector arm
 *  and fuse them. Set to "false" to fall back to pure dense retrieval. */
export const RAG_HYBRID_SEARCH = (process.env.RAG_HYBRID_SEARCH ?? "true") === "true";
