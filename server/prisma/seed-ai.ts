import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

async function ensureAiAgent() {
  const email = "ai@example.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: Role.AGENT, name: "AI", deletedAt: null },
    });
    console.log(`[seed-ai] AI Agent ${email} already exists — updated name and role`);
    return existing;
  }

  // Create user directly
  const ai = await prisma.user.create({
    data: {
      email,
      name: "AI",
      emailVerified: true,
      role: Role.AGENT,
    },
  });
  console.log(`[seed-ai] AI Agent created: ${email}`);
  return ai;
}

await ensureAiAgent();
await prisma.$disconnect();
console.log("[seed-ai] Done.");
