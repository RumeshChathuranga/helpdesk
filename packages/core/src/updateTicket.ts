import { z } from "zod";
import {
  requesterTypeSchema,
  ticketCategorySchema,
  ticketStatusSchema,
} from "./ticketEnums.js";

export const updateTicketBodySchema = z
  .object({
    status: ticketStatusSchema.optional(),
    category: ticketCategorySchema.optional(),
    assignedToId: z.string().trim().nullable().optional(),
    requesterType: requesterTypeSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.category !== undefined ||
      data.assignedToId !== undefined ||
      data.requesterType !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateTicketBody = z.infer<typeof updateTicketBodySchema>;
