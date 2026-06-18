import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";
import { sanitizePlainText } from "./sanitizePlainText.js";

export const updateUserBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(
      FIELD_LIMITS.name,
      `Name must be at most ${FIELD_LIMITS.name} characters`,
    )
    .transform(sanitizePlainText),
  email: z
    .string()
    .email("Enter a valid email")
    .max(
      FIELD_LIMITS.email,
      `Email must be at most ${FIELD_LIMITS.email} characters`,
    ),
  password: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .refine(
      (s) =>
        s === "" ||
        (s.length >= 8 && s.length <= FIELD_LIMITS.password),
      {
        message: `Password must be between 8 and ${FIELD_LIMITS.password} characters`,
      },
    ),
});

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
