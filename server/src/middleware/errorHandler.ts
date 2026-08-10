import { isAPIError } from "better-auth/api";
import type { ErrorRequestHandler } from "express";
import { childLogger } from "../lib/logger.js";

const log = childLogger("http");

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isAPIError(err)) {
    const duplicate =
      err.status === "UNPROCESSABLE_ENTITY" || err.statusCode === 422;
    const status = duplicate ? 409 : err.statusCode >= 400 ? err.statusCode : 400;
    const message =
      (typeof err.body === "object" &&
        err.body &&
        "message" in err.body &&
        typeof err.body.message === "string" &&
        err.body.message) ||
      err.message;
    res.status(status).json({ error: message });
    return;
  }

  const status: number = err.status ?? err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Logged at every level now, not just in dev — the response body still hides
  // internals in production, but a 500 nobody can see is a 500 nobody can fix.
  if (status >= 500) {
    log.error({ err, status }, "request failed");
  } else if (!isProduction) {
    log.debug({ err, status }, "request rejected");
  }

  // In production, suppress internal error details for 5xx responses to
  // avoid leaking Prisma error messages, stack traces, or schema information.
  const message: string =
    isProduction && status >= 500
      ? "Internal Server Error"
      : (err.message ?? "Internal Server Error");

  res.status(status).json({ error: message });
};
