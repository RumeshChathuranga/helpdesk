// Docker HEALTHCHECK CMD. Runs under Bun, no dependency on the base image.
const port = Number(process.env.PORT) || 3000;

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
