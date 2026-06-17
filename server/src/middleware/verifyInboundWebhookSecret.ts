import type { NextFunction, Request, Response } from "express";

function getInboundWebhookSecret(): string | undefined {
  if (process.env.INBOUND_WEBHOOK_SECRET) {
    return process.env.INBOUND_WEBHOOK_SECRET;
  }
  if (process.env.NODE_ENV === "test") {
    return "test-inbound-webhook-secret";
  }
  return undefined;
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
  if (authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
