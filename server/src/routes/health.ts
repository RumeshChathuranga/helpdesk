import { Router, type IRouter } from "express";
import { isShuttingDown } from "../lib/shutdownState.js";
import { prisma } from "../lib/prisma.js";

export const healthRouter: IRouter = Router();

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

/** Legacy alias kept byte-compatible: playwright.config.ts polls this exact
 *  shape as its webServer readiness gate. */
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Is the process alive? Never touches the database — a slow/down Postgres
 *  must not make an orchestrator think the process itself is dead and kill it. */
healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Should this instance receive traffic? False while draining on shutdown, or
 *  if the database is unreachable. */
healthRouter.get("/ready", async (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({
      status: "not_ready",
      checks: { database: "unknown" },
      reason: "shutting_down",
    });
    return;
  }

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout(2000)]);
    res.json({ status: "ok", timestamp: new Date().toISOString(), checks: { database: "ok" } });
  } catch (err) {
    res.status(503).json({
      status: "not_ready",
      checks: { database: "error" },
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
});
