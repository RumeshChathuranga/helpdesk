import "./instrument.js";
import { createApp, createHealthApp } from "./app.js";
import { APP_ROLE } from "./config.js";
import { startBoss } from "./lib/boss.js";
import { installShutdownHandlers } from "./lib/shutdown.js";
import { registerAllWorkers } from "./jobs/registerWorkers.js";

if (!process.env.BETTER_AUTH_SECRET) {
  console.error("FATAL: BETTER_AUTH_SECRET env var is not set");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL env var is not set");
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

const server = app.listen(PORT, () => {
  console.log(`[${APP_ROLE}] listening on http://localhost:${PORT}`);
});

installShutdownHandlers(server);
