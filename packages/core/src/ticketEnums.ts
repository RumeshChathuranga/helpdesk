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
  "ACCOUNT_ACCESS",
  "EMAIL",
  "NETWORK",
  "WIFI_EDUROAM",
  "LMS_MOODLE",
  "LEARNORG_MIS",
  "ERP_DMS",
  "SOFTWARE_LICENSING",
  "ZOOM_CONFERENCING",
  "WEB_HOSTING",
  "HARDWARE",
  "OTHER",
]);

export const requesterTypeSchema = z.enum([
  "STUDENT",
  "ACADEMIC_STAFF",
  "ACADEMIC_SUPPORT_STAFF",
  "ADMINISTRATIVE_STAFF",
  "TECHNICAL_STAFF",
  "NON_ACADEMIC_STAFF",
]);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketCategory = z.infer<typeof ticketCategorySchema>;
export type RequesterType = z.infer<typeof requesterTypeSchema>;
