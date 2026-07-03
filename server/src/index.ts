import "./instrument.js";
import { createApp } from "./app.js";
import { startBoss } from "./lib/boss.js";
import { registerClassifyTicketWorker } from "./jobs/classifyTicket.js";
import { registerProcessTicketWorker } from "./jobs/processTicket.js";

if (!process.env.BETTER_AUTH_SECRET) {
  console.error("FATAL: BETTER_AUTH_SECRET env var is not set");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL env var is not set");
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 8080;

const app = createApp();

// Start pg-boss and register all job workers before accepting HTTP traffic
await startBoss();
await registerClassifyTicketWorker();
await registerProcessTicketWorker();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
