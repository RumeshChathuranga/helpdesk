import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prisma } from "./prisma.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: [process.env.CLIENT_URL ?? "http://localhost:5173"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") {
        return;
      }
      const email = ctx.body?.email;
      if (typeof email !== "string" || !email.trim()) {
        return;
      }
      const user = await prisma.user.findUnique({
        where: { email: email.trim() },
        select: { deletedAt: true },
      });
      if (user?.deletedAt != null) {
        throw new APIError("UNAUTHORIZED", {
          message: "Invalid email or password",
        });
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
