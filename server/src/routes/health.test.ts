import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { setShuttingDown } from "../lib/shutdownState.js";
import { startTestServer } from "../test/helpers.js";

interface HealthBody {
  status: string;
  timestamp?: string;
  checks?: { database: string };
  reason?: string;
}

describe("Health routes", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(() => {
    const app = createApp();
    ({ server, baseUrl } = startTestServer(app));
  });

  afterEach(() => {
    setShuttingDown(false);
  });

  afterAll(() => {
    server?.close();
  });

  it("GET /api/health returns the legacy ok shape", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  it("GET /api/health/live never touches the database and returns ok", async () => {
    const res = await fetch(`${baseUrl}/api/health/live`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("ok");
  });

  it("GET /api/health/ready returns ok with a database check when healthy", async () => {
    const res = await fetch(`${baseUrl}/api/health/ready`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ database: "ok" });
  });

  it("GET /api/health/ready returns 503 while shutting down", async () => {
    setShuttingDown(true);
    const res = await fetch(`${baseUrl}/api/health/ready`);
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("not_ready");
    expect(body.reason).toBe("shutting_down");
  });
});
