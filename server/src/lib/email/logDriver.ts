import { childLogger } from "../logger.js";
import type { EmailDriver, EmailMessage, SendResult } from "./types.js";

const log = childLogger("email:log");

/** Dev/test/CI default — never opens a socket, just prints the composed message. */
export function createLogDriver(): EmailDriver {
  return {
    name: "log",
    async send(message: EmailMessage): Promise<SendResult> {
      log.info(
        {
          to: message.to,
          toName: message.toName,
          from: message.from,
          fromName: message.fromName,
          subject: message.subject,
          messageId: message.messageId,
          inReplyTo: message.inReplyTo,
          references: message.references,
          text: message.text,
        },
        "would send email",
      );
      return { ok: true, messageId: message.messageId, accepted: [message.to] };
    },
  };
}
