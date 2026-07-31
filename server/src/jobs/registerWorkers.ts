import { registerProcessTicketWorker } from "./processTicket.js";
import { registerEmbedDocumentWorker } from "./embed-document.js";
import { registerSweepStaleTicketsWorker } from "./sweepStaleTickets.js";
import { registerSendEmailWorker } from "./sendEmail.js";

/** Registers every pg-boss worker. A new queue must be added here or its jobs
 *  pile up unprocessed — this is the one place the worker list lives. */
export async function registerAllWorkers(): Promise<void> {
  await registerProcessTicketWorker();
  await registerEmbedDocumentWorker();
  await registerSweepStaleTicketsWorker();
  await registerSendEmailWorker();
}
