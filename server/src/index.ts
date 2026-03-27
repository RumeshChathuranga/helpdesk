import { createApp } from "./app.js";

if (!process.env.BETTER_AUTH_SECRET) {
  console.error("FATAL: BETTER_AUTH_SECRET env var is not set");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL env var is not set");
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 8080;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
