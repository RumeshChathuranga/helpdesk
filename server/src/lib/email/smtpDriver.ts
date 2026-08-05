import nodemailer from "nodemailer";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
} from "../../config.js";
import type { EmailDriver, EmailMessage, SendResult } from "./types.js";

interface NodemailerErrorLike {
  responseCode?: number;
  code?: string;
  message?: string;
}

function isPermanentError(err: NodemailerErrorLike): boolean {
  if (err.code === "EAUTH") return true;
  if (typeof err.responseCode === "number") return err.responseCode >= 500;
  return false;
}

/**
 * Gmail SMTP via an App Password. EMAIL_FROM must equal SMTP_USER (or a
 * verified alias) or Gmail silently rewrites the From header. Needs 2-Step
 * Verification; regular account passwords are rejected.
 */
export function createSmtpDriver(): EmailDriver {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    throw new Error(
      "SMTP_USER and SMTP_PASSWORD must be set to use the smtp email driver",
    );
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      // Google renders app passwords in four 4-char groups; users paste the spaces.
      pass: SMTP_PASSWORD.replace(/\s+/g, ""),
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return {
    name: "smtp",
    async send(message: EmailMessage): Promise<SendResult> {
      try {
        const info = await transport.sendMail({
          from: message.fromName ? { name: message.fromName, address: message.from } : message.from,
          to: message.toName ? { name: message.toName, address: message.to } : message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          text: message.text,
          messageId: message.messageId,
          inReplyTo: message.inReplyTo,
          references: message.references,
          headers: message.headers,
        });
        return {
          ok: true,
          messageId: info.messageId || message.messageId,
          accepted: info.accepted.map(String),
          providerResponse: info.response,
        };
      } catch (err) {
        const nmErr = err as NodemailerErrorLike;
        return {
          ok: false,
          permanent: isPermanentError(nmErr),
          error: nmErr.message ?? String(err),
        };
      }
    },
  };
}
