import { PgBoss } from "pg-boss";
import { childLogger } from "./logger.js";

const log = childLogger("pg-boss");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before importing the pg-boss singleton");
}

/** Singleton — all enqueueing and worker registration goes through this. */
export const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
});

boss.on("error", (err: Error) => {
  log.error({ err }, "unhandled pg-boss error");
});

/** Await once during startup, before any boss.send() or boss.work(). */
export async function startBoss(): Promise<void> {
  await boss.start();
  log.info("started");
}

/** Waits up to `timeoutMs` for in-flight jobs so a deploy can't kill one mid-flight. */
export async function stopBoss(timeoutMs: number): Promise<void> {
  await boss.stop({ graceful: true, timeout: timeoutMs, close: true });
  log.info("stopped");
}
