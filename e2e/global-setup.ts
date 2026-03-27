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

  execSync("bunx prisma migrate deploy", {
    cwd: resolve(__dirname, "../server"),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  console.log("[Playwright] Test database is ready.\n");
}
