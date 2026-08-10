import type { Server } from "node:http";
import { SHUTDOWN_DRAIN_MS, SHUTDOWN_JOB_TIMEOUT_MS, SHUTDOWN_TIMEOUT_MS } from "../config.js";
import { stopBoss } from "./boss.js";
import { childLogger } from "./logger.js";
import { prisma } from "./prisma.js";
import { setShuttingDown } from "./shutdownState.js";

const log = childLogger("shutdown");

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    // Idle keep-alive sockets would otherwise hold the listener open until
    // their own timeout; in-flight requests are left alone so they can finish.
    server.closeIdleConnections?.();
  });
}

/**
 * Drain sequence without `process.exit`, so tests can drive it. Order matters:
 * readiness → drain window → stop accepting → finish jobs → disconnect.
 */
export async function drainAndShutdown(server: Server, metricsServer?: Server): Promise<void> {
  setShuttingDown(true);

  if (SHUTDOWN_DRAIN_MS > 0) await delay(SHUTDOWN_DRAIN_MS);

  await close(server);

  await stopBoss(SHUTDOWN_JOB_TIMEOUT_MS);
  await prisma.$disconnect();

  // Last, so a scrape landing mid-drain still reports this pod's final counters.
  if (metricsServer) await close(metricsServer);
}

/** Registers SIGTERM/SIGINT handlers that run drainAndShutdown before exiting. */
export function installShutdownHandlers(server: Server, metricsServer?: Server): void {
  let handled = false;

  async function onSignal(signal: NodeJS.Signals): Promise<void> {
    if (handled) return;
    handled = true;
    log.info({ signal }, "received signal, draining");

    const watchdog = setTimeout(() => {
      log.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "shutdown did not complete, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    watchdog.unref();

    try {
      await drainAndShutdown(server, metricsServer);
      clearTimeout(watchdog);
      log.info("shutdown complete");
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      log.error({ err }, "shutdown failed");
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void onSignal("SIGTERM"));
  process.on("SIGINT", () => void onSignal("SIGINT"));
}
