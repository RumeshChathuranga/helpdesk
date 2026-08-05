import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

/** Sign-up-only Better Auth instance, same DB. Public routes use ./auth.js,
 *  which has sign-up disabled. */
const internalAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
});

export type SignUpEmailBody = {
  email: string;
  password: string;
  name: string;
};

export async function signUpEmailInternal(
  body: SignUpEmailBody,
): Promise<void> {
  await internalAuth.api.signUpEmail({ body });
}
