/** AI agent's user account email — must match a seeded User row for auto-assignment to work. */
export const AI_AGENT_EMAIL = process.env.AI_AGENT_EMAIL ?? "ai@example.com";

/** From-name/sign-off email used in AI-polished agent replies. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@example.com";

/** Product/brand name surfaced in AI system prompts. */
export const BRAND_NAME = process.env.BRAND_NAME ?? "Helpdesk";

/** Chat model used for classification, RAG replies, summaries, and reply polishing. */
export const AI_MODEL = process.env.AI_MODEL ?? "o4-mini";

/** OpenAI-compatible endpoint serving AI_MODEL. */
export const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://models.inference.ai.azure.com";

/** Outbound email adapter selection. Defaults to a no-op logger everywhere
 *  except production, so dev/test/CI can never open a socket to a real
 *  mail provider by accident. */
export const EMAIL_DRIVER =
  process.env.EMAIL_DRIVER ?? (process.env.NODE_ENV === "production" ? "smtp" : "log");

/** Envelope/header From address for outbound mail. For the Gmail SMTP driver
 *  this must equal SMTP_USER (or a verified "Send mail as" alias), or Gmail
 *  silently rewrites the From header. */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? SUPPORT_EMAIL;

/** Display name shown alongside EMAIL_FROM. */
export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? BRAND_NAME;

/** Reply-To header — where customer replies should land. */
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO ?? EMAIL_FROM;

/** Right-hand side of generated outbound Message-IDs. */
export const EMAIL_MESSAGE_ID_DOMAIN =
  process.env.EMAIL_MESSAGE_ID_DOMAIN ?? EMAIL_FROM.split("@")[1] ?? "helpdesk.local";

export const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
export const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
export const SMTP_SECURE = (process.env.SMTP_SECURE ?? "true") === "true";
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
