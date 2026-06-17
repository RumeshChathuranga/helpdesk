import "dotenv/config";
import { Role } from "@prisma/client";
import { signUpEmailInternal } from "../src/lib/internalEmailSignUp.js";
import { prisma } from "../src/lib/prisma.js";
import { buildTicketFixtures } from "./ticketFixtures.js";

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
  const fixtures = buildTicketFixtures(100);

  for (const ticket of fixtures) {
    await prisma.ticket.upsert({
      where: { externalMessageId: ticket.externalMessageId },
      create: ticket,
      update: {
        subject: ticket.subject,
        body: ticket.body,
        status: ticket.status,
        category: ticket.category,
        fromEmail: ticket.fromEmail,
        fromName: ticket.fromName,
        createdAt: ticket.createdAt,
      },
    });
  }

  console.log(`Ensured ${fixtures.length} sample tickets`);
}

await ensureAdmin();
await seedSampleTickets();
await prisma.$disconnect();
