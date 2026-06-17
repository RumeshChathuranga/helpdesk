import { z } from "zod";
import { ticketCategorySchema } from "./ticketEnums.js";

export const createTicketBodySchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Body is required"),
  category: ticketCategorySchema.optional(),
  assignedToId: z.string().trim().optional(),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;
