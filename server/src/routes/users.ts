import { createUserBodySchema } from "core";
import { Role } from "@prisma/client";
import { Router, type IRouter } from "express";
import { signUpEmailInternal } from "../lib/internalEmailSignUp.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const usersRouter: IRouter = Router();

const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

usersRouter.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: userListSelect,
  });
  res.json({ users });
});

usersRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = createUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    res.status(400).json({ error: first });
    return;
  }

  const { name, email, password } = parsed.data;

  await signUpEmailInternal({ email, password, name });
  await prisma.user.update({
    where: { email },
    data: { role: Role.AGENT },
  });

  const user = await prisma.user.findUnique({
    where: { email },
    select: userListSelect,
  });

  if (!user) {
    res.status(500).json({ error: "User was not created" });
    return;
  }

  res.status(201).json({ user });
});
