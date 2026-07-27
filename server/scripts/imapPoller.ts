/// <reference types="bun-types" />

// Dev-only tool: polls a real mailbox (e.g. a Gmail inbox) over IMAP and
// forwards each unseen message to this app's own inbound-email webhook, so
// you can test the full reply loop against a real email address without a
// production inbound-email provider configured. See docs/email-setup.md.
//
// Usage: bun run --filter server email:poll   (from the repo root)
//    or: bun scripts/imapPoller.ts             (from server/)

import "dotenv/config";
import { pollOnce } from "../src/lib/email/imapPoller.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FATAL: ${name} must be set — see docs/email-setup.md`);
    process.exit(1);
  }
  return value;
}

if (process.env.ALLOW_IMAP_POLLER !== "true") {
  console.error(
    "FATAL: set ALLOW_IMAP_POLLER=true to run this dev-only tool (see docs/email-setup.md). " +
      "It is never started by the app itself.",
  );
  process.exit(1);
}

const config = {
  host: process.env.IMAP_HOST ?? "imap.gmail.com",
  port: Number(process.env.IMAP_PORT ?? 993),
  secure: (process.env.IMAP_SECURE ?? "true") === "true",
  user: requireEnv("IMAP_USER"),
  password: requireEnv("IMAP_PASSWORD").replace(/\s+/g, ""),
  mailbox: process.env.IMAP_MAILBOX ?? "INBOX",
  processedMailbox: process.env.IMAP_PROCESSED_MAILBOX || undefined,
  maxPerPoll: Number(process.env.IMAP_MAX_PER_POLL ?? 25),
  webhookUrl: requireEnv("INBOUND_WEBHOOK_URL"),
  webhookSecret: requireEnv("INBOUND_WEBHOOK_SECRET"),
};

const pollIntervalMs = Number(process.env.IMAP_POLL_INTERVAL_MS ?? 15_000);

let stopping = false;
process.on("SIGINT", () => {
  console.log("\n[imap-poller] Shutting down...");
  stopping = true;
});

console.log(
  `[imap-poller] Polling ${config.user} (${config.mailbox}) every ${pollIntervalMs}ms → ${config.webhookUrl}`,
);

while (!stopping) {
  try {
    const result = await pollOnce(config);
    if (result.seen > 0) {
      console.info(
        `[imap-poller] Poll complete: ${result.ingested} ingested, ${result.failed} failed, ${result.seen} seen`,
      );
    }
  } catch (err) {
    console.error("[imap-poller] Poll failed:", err);
  }

  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}
