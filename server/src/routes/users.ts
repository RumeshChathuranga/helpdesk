import { createUserBodySchema, updateUserBodySchema } from "core";
import { Role } from "@prisma/client";
import { Router, type IRouter } from "express";
import type { ZodError } from "zod";
import { hashPasswordForUser } from "../lib/hashPasswordForUser.js";
import { signUpEmailInternal } from "../lib/internalEmailSignUp.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAgent } from "../middleware/requireAgent.js";

const CREDENTIAL_PROVIDER_ID = "credential" as const;

function firstZodIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export const usersRouter: IRouter = Router();

const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

const agentListSelect = {
  id: true,
  name: true,
  email: true,
} as const;

usersRouter.get("/agents", requireAgent, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { in: [Role.ADMIN, Role.AGENT] },
    },
    orderBy: { name: "asc" },
    select: agentListSelect,
  });
  res.json({ users });
});

usersRouter.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: userListSelect,
  });
  res.json({ users });
});

usersRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = createUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return;
  }

  const { name, email, password } = parsed.data;

  const activeWithEmail = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true },
  });
  if (activeWithEmail) {
    res.status(409).json({ error: "User already exists" });
    return;
  }

  await signUpEmailInternal({ email, password, name });
  await prisma.user.update({
    where: { email },
    data: { role: Role.AGENT },
  });

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: userListSelect,
  });

  if (!user) {
    res.status(500).json({ error: "User was not created" });
    return;
  }

  res.status(201).json({ user });
});

usersRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = updateUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstZodIssueMessage(parsed.error) });
    return;
  }

  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, email: true },
  });

  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (email !== existing.email) {
    const taken = await prisma.user.findFirst({
      where: { email, deletedAt: null, NOT: { id } },
      select: { id: true },
    });
    if (taken) {
      res.status(409).json({ error: "User already exists" });
      return;
    }
  }

  const wantsPasswordChange = password.length > 0;

  if (wantsPasswordChange) {
    const credentialAccount = await prisma.account.findFirst({
      where: { userId: id, providerId: CREDENTIAL_PROVIDER_ID },
    });
    if (!credentialAccount) {
      res.status(400).json({
        error: "No password account found for this user",
      });
      return;
    }

    const hashed = await hashPasswordForUser(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { name, email },
      }),
      prisma.account.update({
        where: { id: credentialAccount.id },
        data: { password: hashed },
      }),
    ]);
  } else {
    await prisma.user.update({
      where: { id },
      data: { name, email },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: userListSelect,
  });

  if (!user) {
    res.status(500).json({ error: "User was not found after update" });
    return;
  }

  res.json({ user });
});

usersRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });

  if (!target || target.deletedAt != null) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (target.role === Role.ADMIN) {
    res.status(403).json({ error: "Admin accounts cannot be deleted" });
    return;
  }

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);

  res.status(204).send();
});
