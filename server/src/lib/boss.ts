import { PgBoss } from "pg-boss";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before importing the pg-boss singleton");
}

/**
 * Singleton pg-boss instance.
 * All job enqueueing and worker registration must go through this instance.
 */
export const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
});

boss.on("error", (err: Error) => {
  console.error("[pg-boss] Unhandled error:", err);
});

/**
 * Starts pg-boss. Must be awaited once during server startup before any
 * calls to boss.send() or boss.work().
 */
export async function startBoss(): Promise<void> {
  await boss.start();
  console.log("[pg-boss] Started");
}

/**
 * Stops pg-boss gracefully: waits up to `timeoutMs` for in-flight jobs to
 * finish before closing the connection pool, so a deploy doesn't kill a job
 * mid-flight.
 */
export async function stopBoss(timeoutMs: number): Promise<void> {
  await boss.stop({ graceful: true, timeout: timeoutMs, close: true });
  console.log("[pg-boss] Stopped");
}
