import type { Express } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// These intentionally throw on failure — a down DB or broken login should
// fail loudly, not turn into silent no-op passes.

export interface TestServer {
  server: Server;
  baseUrl: string;
}

/** Starts `app` on an ephemeral port and returns its base URL. */
export function startTestServer(app: Express): TestServer {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

const SETUP_HINT =
  "Is the test DB migrated + seeded? Run `bun run db:migrate:deploy` and " +
  "`bun prisma/seed-test.ts` in server/ against helpdesk_test.";

async function login(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(
      `Login as ${email} failed with status ${res.status}. ${SETUP_HINT}`,
    );
  }

  const cookie = res.headers.getSetCookie().join("; ");
  if (!cookie) {
    throw new Error(
      `Login as ${email} succeeded but returned no session cookie. ${SETUP_HINT}`,
    );
  }

  return cookie;
}

/** Logs in as the seeded AGENT fixture user; throws loudly on failure. */
export async function loginAsAgent(baseUrl: string): Promise<string> {
  return login(baseUrl, "agent@example.com", "password@123");
}

/** Logs in as the seeded ADMIN fixture user; throws loudly on failure. */
export async function loginAsAdmin(baseUrl: string): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set in server/.env.test",
    );
  }
  return login(baseUrl, email, password);
}
