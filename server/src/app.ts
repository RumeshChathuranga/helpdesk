import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";
import * as Sentry from "@sentry/bun";
import { auth } from "./lib/auth.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // One proxy hop (Railway) sits in front of the app; without this every client
  // shares a single rate-limit bucket keyed on the proxy's IP.
  app.set("trust proxy", 1);
  app.use(helmet());

  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? "http://localhost:5173",
      credentials: true,
    })
  );

  if (process.env.NODE_ENV === "production") {
    app.use("/api/auth", authLimiter);
    app.use("/api", apiLimiter);
  }

  // Better Auth handler must come before express.json() — it reads the raw body
  app.all("/api/auth/{*path}", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use("/api", router);

  if (process.env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const clientDistPath = path.resolve(__dirname, "../../client/dist");
    
    app.use(express.static(clientDistPath));
    app.get(/(.*)/, (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  // Sentry error handler must be registered before custom error handlers
  Sentry.setupExpressErrorHandler(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
