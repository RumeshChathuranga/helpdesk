import { EMAIL_DRIVER } from "../../config.js";
import { childLogger } from "../logger.js";
import { createLogDriver } from "./logDriver.js";
import { createSmtpDriver } from "./smtpDriver.js";
import type { EmailDriver } from "./types.js";

let cached: EmailDriver | undefined;

export function getEmailDriver(): EmailDriver {
  if (!cached) {
    cached = EMAIL_DRIVER === "smtp" ? createSmtpDriver() : createLogDriver();
    childLogger("email").info({ driver: cached.name }, "email driver selected");
  }
  return cached;
}

/** Test seam — see the warning in src/test/mockAi.ts about mock.module's
 *  shared registry across bun test files; an explicit setter avoids that. */
export function setEmailDriverForTesting(driver: EmailDriver | undefined): void {
  cached = driver;
}

export type { EmailDriver, EmailMessage, SendResult } from "./types.js";
export { buildOutboundMessageId } from "./messageId.js";
export { buildReplySubject, buildThreadHeaders } from "./threading.js";
