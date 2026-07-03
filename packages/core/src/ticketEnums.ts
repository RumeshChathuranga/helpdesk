import { z } from "zod";

export const ticketStatusSchema = z.enum([
  "NEW",
  "PROCESSING",
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

/** Statuses that are visible to agents in the ticket list */
export const AGENT_VISIBLE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const satisfies TicketStatus[];

export type AgentVisibleStatus = (typeof AGENT_VISIBLE_STATUSES)[number];

export const ticketCategorySchema = z.enum([
  "BILLING",
  "TECHNICAL",
  "GENERAL",
  "FEATURE_REQUEST",
  "BUG",
  "OTHER",
]);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketCategory = z.infer<typeof ticketCategorySchema>;
