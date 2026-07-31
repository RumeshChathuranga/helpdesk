import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import { drainAndShutdown } from "./shutdown.js";
import { isShuttingDown, setShuttingDown } from "./shutdownState.js";

function fakeServer(events: string[], closeError?: Error): Server {
  return {
    close: (cb: (err?: Error) => void) => {
      events.push("server.close");
      cb(closeError);
    },
    closeIdleConnections: () => {
      events.push("closeIdleConnections");
    },
  } as unknown as Server;
}

describe("drainAndShutdown", () => {
  afterEach(() => {
    setShuttingDown(false);
  });

  it("flips readiness synchronously, before the server is closed", () => {
    const events: string[] = [];
    expect(isShuttingDown()).toBe(false);

    const promise = drainAndShutdown(fakeServer(events));
    // No await yet — the flag must already be true so a concurrent
    // /api/health/ready request sees 503 immediately.
    expect(isShuttingDown()).toBe(true);

    return promise;
  });

  it("closes the server and boss/prisma cleanly with no in-flight jobs", async () => {
    const events: string[] = [];
    await expect(drainAndShutdown(fakeServer(events))).resolves.toBeUndefined();
    expect(events).toEqual(["server.close", "closeIdleConnections"]);
  });

  it("propagates a server.close error instead of swallowing it", async () => {
    const events: string[] = [];
    const closeError = new Error("already closed");
    await expect(drainAndShutdown(fakeServer(events, closeError))).rejects.toThrow(
      "already closed",
    );
  });
});
