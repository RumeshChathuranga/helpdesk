import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { httpMetrics } from "../middleware/httpMetrics.js";
import { startTestServer } from "../test/helpers.js";
import { aiProviderErrors, initMetrics, registry, withAiErrorMetric } from "./metrics.js";
import { createMetricsApp } from "./metricsServer.js";

async function aiErrorCount(operation: string): Promise<number> {
  const { values } = await aiProviderErrors.get();
  return values.find((v) => v.labels.operation === operation)?.value ?? 0;
}

describe("metrics endpoint", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(() => {
    initMetrics();
    ({ server, baseUrl } = startTestServer(createMetricsApp()));
  });

  afterAll(() => {
    server?.close();
  });

  it("serves the Prometheus exposition format", async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");

    const body = await res.text();
    expect(body).toContain("# TYPE helpdesk_tickets_processed_total counter");
    expect(body).toContain("# TYPE helpdesk_ticket_pipeline_duration_seconds histogram");
    expect(body).toContain("# TYPE helpdesk_pgboss_queue_depth gauge");
    // collectDefaultMetrics — proves the registry is wired, not just declared.
    expect(body).toContain("process_cpu_seconds_total");
  });

  it("exports every ticket outcome at zero before anything happens", async () => {
    // A missing series and a genuinely-zero series look the same on a graph;
    // this is what makes "nothing escalated" distinguishable from "broken".
    const body = await (await fetch(`${baseUrl}/metrics`)).text();
    for (const outcome of ["resolved", "awaiting_approval", "escalated", "failed"]) {
      expect(body).toContain(`helpdesk_tickets_processed_total{outcome="${outcome}"}`);
    }
  });
});

describe("withAiErrorMetric", () => {
  it("counts a provider failure and rethrows the original error", async () => {
    const before = await aiErrorCount("polish");

    await expect(
      withAiErrorMetric("polish", async () => {
        throw new Error("provider exploded");
      }),
    ).rejects.toThrow("provider exploded");

    expect(await aiErrorCount("polish")).toBe(before + 1);
  });

  it("leaves the counter alone on success", async () => {
    const before = await aiErrorCount("summarize");

    await expect(withAiErrorMetric("summarize", async () => "ok")).resolves.toBe("ok");

    expect(await aiErrorCount("summarize")).toBe(before);
  });
});

describe("httpMetrics middleware", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(() => {
    const app = express();
    app.use(httpMetrics);
    const router = express.Router();
    router.get("/:id", (_req, res) => res.json({ ok: true }));
    app.use("/api/things", router);
    ({ server, baseUrl } = startTestServer(app));
  });

  afterAll(() => {
    server?.close();
  });

  it("labels a matched request with its route pattern, not its path", async () => {
    await fetch(`${baseUrl}/api/things/abc123`);

    const body = await registry.metrics();
    expect(body).toContain('route="/api/things/:id"');
    expect(body).not.toContain("abc123");
  });

  it("collapses unmatched paths so a scanner cannot mint unbounded series", async () => {
    await fetch(`${baseUrl}/wp-login.php`);
    await fetch(`${baseUrl}/.env`);

    const body = await registry.metrics();
    expect(body).toContain('route="unmatched"');
    expect(body).not.toContain("wp-login");
  });
});
