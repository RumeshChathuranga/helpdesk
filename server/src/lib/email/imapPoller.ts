import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { FIELD_LIMITS } from "core";
import type { InboundEmail } from "core";

export interface ImapPollerConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
  /** Move successfully-ingested messages here instead of just flagging \Seen. */
  processedMailbox?: string;
  maxPerPoll: number;
  /** Where each parsed message is POSTed — normally the app's own inbound webhook. */
  webhookUrl: string;
  webhookSecret: string;
}

export interface PollResult {
  seen: number;
  ingested: number;
  failed: number;
}

function firstAddress(
  parsed: Awaited<ReturnType<typeof simpleParser>>,
): { address: string; name?: string } | undefined {
  const from = parsed.from;
  const entry = Array.isArray(from) ? from[0] : from?.value[0];
  if (!entry?.address) return undefined;
  return { address: entry.address, name: entry.name || undefined };
}

function normalizeReferences(
  references: string[] | string | undefined,
): string[] | undefined {
  if (!references) return undefined;
  const list = Array.isArray(references) ? references : [references];
  return list.length > 0 ? list : undefined;
}

/** Converts a raw IMAP message into the inbound-webhook shape. Returns null for
 *  anything unusable (no From, empty body) rather than failing validation there. */
export async function parseImapMessage(
  source: Buffer,
): Promise<InboundEmail | undefined> {
  const parsed = await simpleParser(source);
  const from = firstAddress(parsed);
  if (!from) return undefined;

  const body = (parsed.text ?? parsed.html ?? "").toString().trim();
  const subject = (parsed.subject ?? "(no subject)").trim();
  if (!body) return undefined;

  return {
    fromEmail: from.address,
    fromName: from.name,
    subject: subject.slice(0, FIELD_LIMITS.subject),
    body: body.slice(0, FIELD_LIMITS.body),
    messageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references: normalizeReferences(parsed.references),
  };
}

async function postToWebhook(
  config: ImapPollerConfig,
  payload: InboundEmail,
): Promise<boolean> {
  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.webhookSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[imap-poller] Webhook rejected message (${res.status}): ${text}`);
    return false;
  }

  const json = (await res.json()) as { ticketId: string; created: string };
  console.info(
    `[imap-poller] ${payload.fromEmail} → ticket ${json.ticketId} (${json.created})`,
  );
  return true;
}

/**
 * One poll cycle: fetch unseen mail, POST each to the inbound webhook, flag or
 * move the accepted ones. Rejected messages stay unseen so the next poll
 * retries them instead of dropping mail silently.
 */
export async function pollOnce(config: ImapPollerConfig): Promise<PollResult> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  const result: PollResult = { seen: 0, ingested: 0, failed: 0 };

  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox);
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) return result;

      const toProcess = uids.slice(0, config.maxPerPoll);
      result.seen = toProcess.length;

      for (const uid of toProcess) {
        const message = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!message || !message.source) {
          result.failed += 1;
          continue;
        }

        let payload: InboundEmail | undefined;
        try {
          payload = await parseImapMessage(message.source);
        } catch (err) {
          console.error(`[imap-poller] Failed to parse message uid ${uid}:`, err);
        }

        if (!payload) {
          result.failed += 1;
          continue;
        }

        const ok = await postToWebhook(config, payload);
        if (!ok) {
          result.failed += 1;
          continue;
        }

        result.ingested += 1;
        if (config.processedMailbox) {
          await client.messageMove(uid, config.processedMailbox, { uid: true });
        } else {
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return result;
}
