import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodType } from "zod";

export function firstZodIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
      return;
    }
    Object.defineProperty(req, "query", {
      value: parsed.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
