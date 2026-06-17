import { z } from "zod";

export const ticketStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

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
