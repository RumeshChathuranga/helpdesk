import type { RequestHandler } from "express";
import { httpRequestDuration } from "../lib/metrics.js";

/**
 * Express only knows which route matched *after* the handler runs, so the label
 * is read on "finish", not on the way in. Unmatched paths collapse to a single
 * "unmatched" label — a scanner probing /wp-login.php must not be able to mint
 * an unbounded number of time series.
 */
function routeLabel(req: Parameters<RequestHandler>[0]): string {
  const matched = req.route?.path;
  if (!matched) return "unmatched";
  const base = req.baseUrl || "";
  return `${base}${matched === "/" && base ? "" : matched}` || "/";
}

export const httpMetrics: RequestHandler = (req, res, next) => {
  const stop = httpRequestDuration.startTimer();

  res.on("finish", () => {
    stop({
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    });
  });

  next();
};
