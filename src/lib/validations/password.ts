import { z } from "zod";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

export function getPasswordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters")
  .refine(
    (password) => getPasswordByteLength(password) <= MAX_PASSWORD_BYTES,
    "Password must be at most 72 bytes",
  );

export const PASSWORD_POLICY_HINT =
  "Use at least 8 characters (max 72 bytes for bcrypt).";
