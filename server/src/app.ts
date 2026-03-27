import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());

  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? "http://localhost:5173",
      credentials: true,
    })
  );

  // Better Auth handler must come before express.json() — it reads the raw body
  app.all("/api/auth/{*path}", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use("/api", router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
