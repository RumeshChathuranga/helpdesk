import "./instrument.js";
import { createApp, createHealthApp } from "./app.js";
import { APP_ROLE, METRICS_ENABLED } from "./config.js";
import { startBoss } from "./lib/boss.js";
import { logger } from "./lib/logger.js";
import { initMetrics } from "./lib/metrics.js";
import { startMetricsServer } from "./lib/metricsServer.js";
import { installShutdownHandlers } from "./lib/shutdown.js";
import { registerAllWorkers } from "./jobs/registerWorkers.js";

if (!process.env.BETTER_AUTH_SECRET) {
  logger.fatal("BETTER_AUTH_SECRET env var is not set");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  logger.fatal("DATABASE_URL env var is not set");
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;

// The worker role serves health checks only — no ticket API surface.
const app = APP_ROLE === "worker" ? createHealthApp() : createApp();

// Every role starts pg-boss: the API needs it to enqueue (boss.send) even
// though it registers no workers itself. Only "all"/"worker" consume jobs.
await startBoss();
if (APP_ROLE !== "api") {
  await registerAllWorkers();
}

// After startBoss() — the queue-depth gauge queries pg-boss on scrape.
let metricsServer;
if (METRICS_ENABLED) {
  initMetrics();
  metricsServer = startMetricsServer();
}

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "listening");
});

installShutdownHandlers(server, metricsServer);
