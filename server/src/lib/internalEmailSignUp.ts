import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

/**
 * Better Auth instance used only for programmatic email/password sign-up
 * (same DB as app auth). Public routes use {@link ./auth.js} with disableSignUp.
 */
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
