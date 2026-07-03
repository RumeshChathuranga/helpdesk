import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

export default async function globalTeardown() {
  config({ path: resolve(__dirname, "../server/.env.test") });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  console.log("\n[Playwright] Cleaning up test database...");
  execSync("bunx prisma migrate reset --force", {
    cwd: resolve(__dirname, "../server"),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
  console.log("[Playwright] Test database cleaned up.\n");
}
