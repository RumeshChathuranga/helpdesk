import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const MIN_SECRET_LENGTH = 32;

function getInboundWebhookSecret(): string | undefined {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return undefined;
  }
  return secret;
}

/**
 * Compares two bearer tokens without leaking their contents through timing.
 * Both sides are hashed first so the buffers are always 32 bytes — otherwise
 * `timingSafeEqual` throws on a length mismatch, which is itself an oracle for
 * the secret's length.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const presentedDigest = createHash("sha256").update(presented).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(presentedDigest, expectedDigest);
}

export function verifyInboundWebhookSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = getInboundWebhookSecret();
  if (!secret) {
    res.status(503).json({ error: "Inbound webhook is not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string" || !secretsMatch(authHeader, `Bearer ${secret}`)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
