import "dotenv/config";
import { Role } from "@prisma/client";
import { signUpEmailInternal } from "../src/lib/internalEmailSignUp.js";
import { prisma } from "../src/lib/prisma.js";

const email = process.env.SEED_ADMIN_EMAIL!;
const password = process.env.SEED_ADMIN_PASSWORD!;

if (!email || !password) {
  console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  process.exit(1);
}

async function ensureAdmin() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: Role.ADMIN } });
    console.log(`User ${email} already exists — role set to ADMIN`);
    return existing;
  }

  await signUpEmailInternal({ email, password, name: "Admin" });
  await prisma.user.update({ where: { email }, data: { role: Role.ADMIN } });
  console.log(`Admin user created: ${email}`);
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function seedSampleTickets() {
  const count = await prisma.ticket.count();
  if (count > 0) {
    console.log(`Skipping ticket seed — ${count} ticket(s) already exist`);
    return;
  }

  const now = Date.now();
  await prisma.ticket.createMany({
    data: [
      {
        subject: "Cannot reset password",
        body: "I tried the forgot-password link but never received an email.",
        status: "OPEN",
        category: "TECHNICAL",
        fromEmail: "customer@example.com",
        fromName: "Jane Customer",
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        subject: "Invoice for March",
        body: "Could you send a copy of my March invoice?",
        status: "IN_PROGRESS",
        category: "BILLING",
        fromEmail: "billing@example.com",
        fromName: "Acme Corp",
        createdAt: new Date(now - 24 * 60 * 60 * 1000),
      },
      {
        subject: "Feature request: dark mode",
        body: "It would be great to have a dark mode option in the dashboard.",
        status: "OPEN",
        category: "FEATURE_REQUEST",
        fromEmail: "dev@example.com",
        fromName: "Sam Developer",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      },
      {
        subject: "Login page error on mobile",
        body: "Seeing a blank screen when logging in from Safari on iOS.",
        status: "RESOLVED",
        category: "BUG",
        fromEmail: "mobile@example.com",
        fromName: null,
        createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("Created 4 sample tickets");
}

await ensureAdmin();
await seedSampleTickets();
await prisma.$disconnect();
