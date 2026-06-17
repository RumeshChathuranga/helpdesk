import { z } from "zod";
import { ticketCategorySchema, ticketStatusSchema } from "./ticketEnums.js";

export const listTicketsQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).optional(),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
