import "./instrument.js";
import { createApp } from "./app.js";
import { startBoss } from "./lib/boss.js";
import { registerProcessTicketWorker } from "./jobs/processTicket.js";
import { registerEmbedDocumentWorker } from "./jobs/embed-document.js";
import { registerSweepStaleTicketsWorker } from "./jobs/sweepStaleTickets.js";
import { registerSendEmailWorker } from "./jobs/sendEmail.js";

if (!process.env.BETTER_AUTH_SECRET) {
  console.error("FATAL: BETTER_AUTH_SECRET env var is not set");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL env var is not set");
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

// Start pg-boss and register all job workers before accepting HTTP traffic
await startBoss();
await registerProcessTicketWorker();
await registerEmbedDocumentWorker();
await registerSweepStaleTicketsWorker();
await registerSendEmailWorker();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
