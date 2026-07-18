import { config } from "dotenv";
import { resolve } from "node:path";

// Bun auto-loads `server/.env` before this preload runs, and dotenv's
// `config()` never overrides variables that already exist in `process.env`.
// Without `override: true`, `DATABASE_URL` would silently stay pinned to the
// dev database instead of `.env.test`'s `helpdesk_test`.
config({
  path: resolve(import.meta.dirname, "../../.env.test"),
  override: true,
});

if (!process.env.DATABASE_URL?.includes("helpdesk_test")) {
  throw new Error(
    "Refusing to run server tests: DATABASE_URL does not point at " +
      `helpdesk_test (got ${JSON.stringify(process.env.DATABASE_URL)}). ` +
      "Check server/.env.test — tests must never run against the dev database.",
  );
}
