import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

export type AgentSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

declare global {
  namespace Express {
    interface Locals {
      agentSession?: AgentSession;
    }
  }
}

export async function requireAgent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Deleting a user revokes their sessions, so this should be unreachable —
  // it's a second line of defence against a soft-deleted account still holding
  // a valid cookie.
  if (session.user.deletedAt != null) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "AGENT") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.locals.agentSession = session;
  next();
}
