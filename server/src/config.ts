/** AI agent's user account email — must match a seeded User row for auto-assignment to work. */
export const AI_AGENT_EMAIL = process.env.AI_AGENT_EMAIL ?? "ai@example.com";

/** From-name/sign-off email used in AI-polished agent replies. */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@example.com";

/** Product/brand name surfaced in AI system prompts. */
export const BRAND_NAME = process.env.BRAND_NAME ?? "Helpdesk";
