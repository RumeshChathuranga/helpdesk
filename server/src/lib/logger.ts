import pino from "pino";
import { APP_ROLE, LOG_LEVEL } from "../config.js";

/**
 * One JSON line per event on stdout — the container runtime writes it to a file
 * and Promtail ships it to Loki. Anything multi-line (a bare stack trace, a
 * console.dir dump) lands there as several unrelated entries, which is why
 * nothing in this codebase writes to console directly.
 */
export const logger: pino.Logger = pino({
  level: LOG_LEVEL,
  base: { role: APP_ROLE },
  // Loki and kubectl both want a readable timestamp, not pino's default epoch ms.
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    // "info", not 30 — the label is what you filter on in Loki.
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "*.password",
      "token",
      "*.token",
    ],
    censor: "[redacted]",
  },
});

/** Per-subsystem child logger. `component` replaces the old "[process-ticket]" prefixes. */
export function childLogger(component: string): pino.Logger {
  return logger.child({ component });
}
