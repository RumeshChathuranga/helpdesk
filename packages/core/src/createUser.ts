import { z } from "zod";
import { FIELD_LIMITS } from "./fieldLimits.js";
import { sanitizePlainText } from "./sanitizePlainText.js";

export const createUserBodySchema = z.object({
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
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(
      FIELD_LIMITS.password,
      `Password must be at most ${FIELD_LIMITS.password} characters`,
    ),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
