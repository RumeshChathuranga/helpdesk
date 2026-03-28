import { Role } from "@prisma/client";
import { signUpEmailInternal } from "../src/lib/internalEmailSignUp.js";
import { prisma } from "../src/lib/prisma.js";

async function ensureUser(
  email: string,
  password: string,
  name: string,
  role: Role
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role } });
    console.log(`[seed-test] ${email} already exists — role set to ${role}`);
    return;
  }
  await signUpEmailInternal({ email, password, name });
  await prisma.user.update({ where: { email }, data: { role } });
  console.log(`[seed-test] Created ${role} user: ${email}`);
}

const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("[seed-test] SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  process.exit(1);
}

await ensureUser(adminEmail, adminPassword, "Admin", Role.ADMIN);
await ensureUser("agent@example.com", "password@123", "Agent", Role.AGENT);

await prisma.$disconnect();
console.log("[seed-test] Done.");
