import { z } from "zod";

export const API_KEY_EXPIRY_OPTIONS = [null, 30, 90, 365] as const;

export type ApiKeyExpiryDays = (typeof API_KEY_EXPIRY_OPTIONS)[number];

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  expiresInDays: z
    .union([z.literal(30), z.literal(90), z.literal(365), z.null()])
    .optional()
    .default(null),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
