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

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.log(`User ${email} already exists — skipping creation`);
  await prisma.user.update({ where: { email }, data: { role: Role.ADMIN } });
  console.log("Role set to ADMIN");
  process.exit(0);
}

await signUpEmailInternal({ email, password, name: "Admin" });

await prisma.user.update({ where: { email }, data: { role: Role.ADMIN } });
console.log(`Admin user created: ${email}`);
process.exit(0);
