import { z } from "zod";

import { isValidEmail, normalizeEmail } from "@/lib/validate-email";

import { passwordSchema } from "./password";

export const registerRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .transform(normalizeEmail)
      .refine(isValidEmail, "Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
