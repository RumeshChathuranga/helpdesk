import { Role, type TicketCategory } from "@prisma/client";
import { signUpEmailInternal } from "../src/lib/internalEmailSignUp.js";
import { prisma } from "../src/lib/prisma.js";
import { AI_AGENT_EMAIL } from "../src/config.js";

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

async function ensureSampleTicket(data: {
  externalMessageId: string;
  subject: string;
  body: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  category: TicketCategory;
  fromEmail: string;
  fromName: string;
  createdAt: Date;
}) {
  await prisma.ticket.upsert({
    where: { externalMessageId: data.externalMessageId },
    create: data,
    update: {
      subject: data.subject,
      body: data.body,
      status: data.status,
      category: data.category,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      createdAt: data.createdAt,
    },
  });
}

async function seedSampleTickets() {
  const now = Date.now();

  await ensureSampleTicket({
    externalMessageId: "seed-test-reset-password",
    subject: "Cannot reset password",
    body: "I tried the forgot-password link but never received an email.",
    status: "OPEN",
    category: "ACCOUNT_ACCESS",
    fromEmail: "customer@example.com",
    fromName: "Jane Customer",
    createdAt: new Date(now - 2 * 60 * 60 * 1000),
  });

  await ensureSampleTicket({
    externalMessageId: "seed-test-invoice-march",
    subject: "Invoice for March",
    body: "Could you send a copy of my March invoice?",
    status: "IN_PROGRESS",
    category: "OTHER",
    fromEmail: "billing@example.com",
    fromName: "Acme Corp",
    createdAt: new Date(now - 24 * 60 * 60 * 1000),
  });

  console.log("[seed-test] Ensured 2 sample tickets");
}

async function ensureAiAgent() {
  const email = AI_AGENT_EMAIL;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: Role.AGENT, name: "AI", deletedAt: null },
    });
    console.log(`[seed-test] AI Agent ${email} already exists — updated name and role`);
    return existing;
  }

  const ai = await prisma.user.create({
    data: {
      email,
      name: "AI",
      emailVerified: true,
      role: Role.AGENT,
    },
  });
  console.log(`[seed-test] AI Agent created: ${email}`);
  return ai;
}

await seedSampleTickets();
await ensureAiAgent();

await prisma.$disconnect();
console.log("[seed-test] Done.");
