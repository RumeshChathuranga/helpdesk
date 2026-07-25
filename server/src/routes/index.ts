import { Router, type IRouter } from "express";
import { ticketsRouter } from "./tickets.js";
import { usersRouter } from "./users.js";
import { inboundEmailWebhookRouter } from "./webhooks/inboundEmail.js";
import { knowledgeRouter } from "./knowledge.js";

export const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/webhooks", inboundEmailWebhookRouter);
router.use("/tickets", ticketsRouter);
router.use("/users", usersRouter);
router.use("/knowledge", knowledgeRouter);
