import { z } from "zod";

export const createReplyBodySchema = z.object({
  body: z.string().trim().min(1, "Reply is required"),
});

export type CreateReplyBody = z.infer<typeof createReplyBodySchema>;
