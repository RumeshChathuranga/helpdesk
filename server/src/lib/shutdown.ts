import type { Server } from "node:http";
import { SHUTDOWN_DRAIN_MS, SHUTDOWN_JOB_TIMEOUT_MS, SHUTDOWN_TIMEOUT_MS } from "../config.js";
import { stopBoss } from "./boss.js";
import { prisma } from "./prisma.js";
import { setShuttingDown } from "./shutdownState.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drain sequence without `process.exit`, so tests can drive it. Order matters:
 * readiness → drain window → stop accepting → finish jobs → disconnect.
 */
export async function drainAndShutdown(server: Server): Promise<void> {
  setShuttingDown(true);

  if (SHUTDOWN_DRAIN_MS > 0) await delay(SHUTDOWN_DRAIN_MS);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    // Idle keep-alive sockets would otherwise hold the listener open until
    // their own timeout; in-flight requests are left alone so they can finish.
    server.closeIdleConnections?.();
  });

  await stopBoss(SHUTDOWN_JOB_TIMEOUT_MS);
  await prisma.$disconnect();
}

/** Registers SIGTERM/SIGINT handlers that run drainAndShutdown before exiting. */
export function installShutdownHandlers(server: Server): void {
  let handled = false;

  async function onSignal(signal: NodeJS.Signals): Promise<void> {
    if (handled) return;
    handled = true;
    console.log(`[shutdown] received ${signal}, draining`);

    const watchdog = setTimeout(() => {
      console.error(`[shutdown] did not complete within ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    watchdog.unref();

    try {
      await drainAndShutdown(server);
      clearTimeout(watchdog);
      console.log("[shutdown] complete");
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error("[shutdown] failed:", err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void onSignal("SIGTERM"));
  process.on("SIGINT", () => void onSignal("SIGINT"));
}
