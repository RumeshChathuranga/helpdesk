import { Router, type IRouter } from "express";
import {
  createFromInboundEmail,
  parseInboundEmail,
} from "../../lib/tickets/createFromInboundEmail.js";
import { verifyInboundWebhookSecret } from "../../middleware/verifyInboundWebhookSecret.js";

export const inboundEmailWebhookRouter: IRouter = Router();

inboundEmailWebhookRouter.post(
  "/inbound-email",
  verifyInboundWebhookSecret,
  async (req, res) => {
    const parsed = parseInboundEmail(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const result = await createFromInboundEmail(parsed.data);
    res.status(200).json(result);
  },
);
