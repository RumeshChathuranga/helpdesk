import express, { type Express } from "express";
import type { Server } from "node:http";
import { METRICS_PORT } from "../config.js";
import { childLogger } from "./logger.js";
import { registry } from "./metrics.js";

const log = childLogger("metrics");

/** Scrape surface only — no helmet, no CORS, no auth, because nothing outside
 *  the cluster can reach the port it is served on. */
export function createMetricsApp(): Express {
  const app = express();

  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      log.error({ err }, "failed to render metrics");
      res.status(500).end();
    }
  });

  return app;
}

/**
 * A second listener on its own port. The Ingress routes only the API port, so
 * /metrics is reachable from inside the cluster (Prometheus) and nowhere else —
 * no auth middleware to write, and no leaking route names and error rates
 * publicly. It also gives the worker, which serves no API, a scrape target.
 */
export function startMetricsServer(): Server {
  return createMetricsApp().listen(METRICS_PORT, () => {
    log.info({ port: METRICS_PORT }, "metrics listener started");
  });
}
