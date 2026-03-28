import { z } from "zod";

export const createUserBodySchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
