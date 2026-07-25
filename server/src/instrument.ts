import * as Sentry from "@sentry/bun";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: isProduction ? 0.1 : 1.0,
  debug: false,
  disableInstrumentationWarnings: true,
});
