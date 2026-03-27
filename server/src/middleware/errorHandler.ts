import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status: number = err.status ?? err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    console.error(err);
  }

  // In production, suppress internal error details for 5xx responses to
  // avoid leaking Prisma error messages, stack traces, or schema information.
  const message: string =
    isProduction && status >= 500
      ? "Internal Server Error"
      : (err.message ?? "Internal Server Error");

  res.status(status).json({ error: message });
};
