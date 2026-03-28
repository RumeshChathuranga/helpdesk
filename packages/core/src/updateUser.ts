import { z } from "zod";

export const updateUserBodySchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .refine((s) => s === "" || s.length >= 8, {
      message: "Password must be at least 8 characters",
    }),
});

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
