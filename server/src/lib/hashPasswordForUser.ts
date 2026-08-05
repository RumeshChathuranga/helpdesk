import { hashPassword } from "better-auth/crypto";

/** Hashes with Better Auth's default algorithm, same as sign-up. */
export async function hashPasswordForUser(plain: string): Promise<string> {
  return hashPassword(plain);
}
