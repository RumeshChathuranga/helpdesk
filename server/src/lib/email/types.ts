export interface EmailMessage {
  /** RFC 5322 addr-spec. Always ticket.fromEmail — never a list. */
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  /** Already normalised: exactly one "Re: " prefix (see threading.ts). */
  subject: string;
  /** Plain text only — we never compose HTML. */
  text: string;
  /** Our pre-generated Message-ID, angle-bracketed: "<reply.abc@domain>". */
  messageId: string;
  /** Angle-bracketed msg-id of the message being answered. */
  inReplyTo?: string;
  /** Angle-bracketed msg-ids, oldest → newest; last element === inReplyTo. */
  references?: string[];
  /** Extra headers: X-CITeS-Reply-Id, X-CITeS-Ticket-Id, Auto-Submitted. */
  headers?: Record<string, string>;
}

export type SendResult =
  | { ok: true; messageId: string; accepted: string[]; providerResponse?: string }
  | { ok: false; permanent: boolean; error: string };

export interface EmailDriver {
  readonly name: "smtp" | "log";
  send(message: EmailMessage): Promise<SendResult>;
}
