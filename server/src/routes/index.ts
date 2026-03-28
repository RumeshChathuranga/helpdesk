import { Router, type IRouter } from "express";
import { usersRouter } from "./users.js";

export const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/users", usersRouter);
