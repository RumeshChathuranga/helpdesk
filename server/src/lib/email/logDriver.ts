import type { EmailDriver, EmailMessage, SendResult } from "./types.js";

/**
 * Dev/test/CI default driver: never opens a socket, just prints the composed
 * message so the send path is fully exercisable without a mail provider.
 */
export function createLogDriver(): EmailDriver {
  return {
    name: "log",
    async send(message: EmailMessage): Promise<SendResult> {
      console.log(
        `[email:log] To: ${message.toName ? `${message.toName} <${message.to}>` : message.to}\n` +
          `[email:log] From: ${message.fromName ? `${message.fromName} <${message.from}>` : message.from}\n` +
          `[email:log] Subject: ${message.subject}\n` +
          `[email:log] Message-ID: ${message.messageId}\n` +
          (message.inReplyTo ? `[email:log] In-Reply-To: ${message.inReplyTo}\n` : "") +
          (message.references?.length
            ? `[email:log] References: ${message.references.join(" ")}\n`
            : "") +
          `[email:log] ---\n${message.text}\n[email:log] ---`,
      );
      return { ok: true, messageId: message.messageId, accepted: [message.to] };
    },
  };
}
