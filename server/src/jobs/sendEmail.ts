import type { Job } from "pg-boss";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { boss } from "../lib/boss.js";
import {
  buildOutboundMessageId,
  buildReplySubject,
  buildThreadHeaders,
  getEmailDriver,
} from "../lib/email/index.js";
import type { SendResult } from "../lib/email/index.js";
import { EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_REPLY_TO } from "../config.js";

// ─── Job contract ─────────────────────────────────────────────────────────────

export const SEND_EMAIL_QUEUE = "send-email" as const;

export interface SendEmailJobData {
  replyId: string;
}

const STALE_SENDING_MS = 5 * 60 * 1000;

// ─── Worker ───────────────────────────────────────────────────────────────────

/** Call once after boss.start() during startup. */
export async function registerSendEmailWorker(): Promise<void> {
  await boss.createQueue(SEND_EMAIL_QUEUE);

  await boss.work<SendEmailJobData>(
    SEND_EMAIL_QUEUE,
    async (jobs: Job<SendEmailJobData>[]) => {
      const job = jobs[0];
      if (!job) return;
      await runSendEmail(job.data.replyId);
    },
  );

  console.log(`[pg-boss] Worker registered for queue: ${SEND_EMAIL_QUEUE}`);
}

/**
 * Sends the email for one reply. Exported separately from the worker so tests
 * can drive it without pg-boss. Three idempotency layers: singletonKey at
 * enqueue, the atomic claim below, and a deterministic per-reply Message-ID so
 * a duplicate delivery collapses in the recipient's client — never randomise it.
 */
export async function runSendEmail(replyId: string): Promise<void> {
  const messageId = buildOutboundMessageId(replyId);
  const staleCutoff = new Date(Date.now() - STALE_SENDING_MS);

  // ── 1. Atomic claim — the double-send guard ──────────────────────────────
  // Only QUEUED/FAILED, or SENDING past the stale cutoff (dead worker), can be
  // claimed. A retry firing while another worker holds the row claims nothing.
  const { count } = await prisma.reply.updateMany({
    where: {
      id: replyId,
      OR: [
        { deliveryState: { in: ["QUEUED", "FAILED"] } },
        { deliveryState: "SENDING", lastSendAttemptAt: { lt: staleCutoff } },
      ],
    },
    data: {
      deliveryState: "SENDING",
      lastSendAttemptAt: new Date(),
      sendAttempts: { increment: 1 },
      externalMessageId: messageId,
      deliveryError: null,
    },
  });

  if (count === 0) {
    console.info(
      `[send-email] Reply ${replyId} not claimable (already sent, discarded, or in flight) — skipping`,
    );
    return;
  }

  // ── 2. Load + guard ───────────────────────────────────────────────────────
  const reply = await prisma.reply.findUnique({
    where: { id: replyId },
    select: {
      id: true,
      body: true,
      isAi: true,
      approval: true,
      direction: true,
      createdAt: true,
      ticket: {
        select: {
          id: true,
          subject: true,
          fromEmail: true,
          fromName: true,
          externalMessageId: true,
          status: true,
          replies: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              externalMessageId: true,
              direction: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const blocked =
    !reply ||
    reply.direction !== "OUTBOUND" ||
    reply.approval === "PENDING_APPROVAL" ||
    reply.approval === "DISCARDED" ||
    !reply.ticket.fromEmail;

  if (blocked) {
    await prisma.reply.updateMany({
      where: { id: replyId, deliveryState: "SENDING" },
      data: { deliveryState: "NOT_QUEUED" },
    });
    console.warn(`[send-email] Reply ${replyId} is not sendable — leaving it unsent`);
    return; // Permanent condition — retrying would not help.
  }

  // ── 3. Compose + send ─────────────────────────────────────────────────────
  const prior = reply.ticket.replies.filter(
    (r) => r.id !== reply.id && r.createdAt < reply.createdAt,
  );
  const { inReplyTo, references } = buildThreadHeaders(
    reply.ticket.externalMessageId,
    prior,
  );

  let result: SendResult;
  try {
    result = await getEmailDriver().send({
      // Narrowed by the `blocked` check above, which already returned if this were falsy.
      to: reply.ticket.fromEmail!,
      toName: reply.ticket.fromName ?? undefined,
      from: EMAIL_FROM,
      fromName: EMAIL_FROM_NAME,
      replyTo: EMAIL_REPLY_TO,
      subject: buildReplySubject(reply.ticket.subject),
      text: reply.body,
      messageId,
      inReplyTo,
      references,
      headers: {
        "X-CITeS-Reply-Id": reply.id,
        "X-CITeS-Ticket-Id": reply.ticket.id,
        ...(reply.isAi ? { "Auto-Submitted": "auto-replied" } : {}),
      },
    });
  } catch (err) {
    // Driver construction / unexpected throw — treat as a permanent config error.
    result = {
      ok: false,
      permanent: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── 4. Record outcome ─────────────────────────────────────────────────────
  if (!result.ok) {
    await prisma.reply.update({
      where: { id: replyId },
      data: { deliveryState: "FAILED", deliveryError: result.error.slice(0, 500) },
    });
    if (result.permanent) {
      console.error(`[send-email] Permanent failure for reply ${replyId}: ${result.error}`);
      return; // Swallow — no retry.
    }
    // Rethrow so pg-boss retries.
    throw new Error(`[send-email] Transient failure for reply ${replyId}: ${result.error}`);
  }

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.reply.update({
      where: { id: replyId },
      data: {
        deliveryState: "SENT",
        sentEmail: true,
        sentAt: new Date(),
        externalMessageId: result.messageId,
        deliveryError: null,
      },
    }),
  ];

  // An approved AI draft only resolves the ticket once the customer has
  // actually been emailed — an approval whose send fails leaves it OPEN.
  if (reply.isAi && reply.approval === "APPROVED" && reply.ticket.status !== "CLOSED") {
    writes.push(
      prisma.ticket.update({ where: { id: reply.ticket.id }, data: { status: "RESOLVED" } }),
    );
  }

  await prisma.$transaction(writes);

  console.info(`[send-email] Reply ${replyId} sent ✓`);
}

// ─── Enqueue helper ───────────────────────────────────────────────────────────

/** `singletonKey` keeps at most one queued job per reply. */
export async function enqueueSendEmail(data: SendEmailJobData): Promise<string | null> {
  return boss.send(SEND_EMAIL_QUEUE, data, {
    singletonKey: data.replyId,
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
  });
}
