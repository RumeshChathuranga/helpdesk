import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

export default async function globalSetup() {
  config({ path: resolve(__dirname, "../server/.env.test") });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in server/.env.test");
  }

  console.log("\n[Playwright] Running migrations on test database...");

  try {
    execSync("bunx prisma migrate deploy", {
      cwd: resolve(__dirname, "../server"),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("permission denied to create database") || message.includes("does not exist")) {
      console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  [Playwright] Test database setup failed                        ║
║                                                                  ║
║  The "helpdesk_test" database does not exist or the DB user      ║
║  lacks permission to create it.                                  ║
║                                                                  ║
║  Fix — run ONE of the following as a Postgres superuser:         ║
║                                                                  ║
║  Option A: create the DB manually                                ║
║    sudo -u postgres psql -c \\                                    ║
║      "CREATE DATABASE helpdesk_test OWNER helpdesk_user;"        ║
║                                                                  ║
║  Option B: grant CREATEDB to your DB user                        ║
║    sudo -u postgres psql -c \\                                    ║
║      "ALTER USER helpdesk_user CREATEDB;"                        ║
║                                                                  ║
║  Then re-run: bun run test:e2e                                    ║
╚══════════════════════════════════════════════════════════════════╝
`);
    }
    throw err;
  }

  console.log("[Playwright] Seeding test users...");

  const testEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL!,
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD!,
  };

  execSync("bun prisma/seed-test.ts", {
    cwd: resolve(__dirname, "../server"),
    env: testEnv,
    stdio: "inherit",
  });

  console.log("[Playwright] Test database is ready.\n");
}
