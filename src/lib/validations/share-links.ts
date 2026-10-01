import { z } from "zod";

export const shareLinkExpirySchema = z.union([
  z.literal(null),
  z.literal(1),
  z.literal(7),
  z.literal(30),
]);

export const createShareLinkSchema = z.object({
  itemId: z.string().trim().min(1),
  expiresInDays: shareLinkExpirySchema,
  regenerate: z.boolean().optional().default(false),
});

export const revokeShareLinkSchema = z.object({
  itemId: z.string().trim().min(1),
});

export const getShareLinkForItemSchema = z.object({
  itemId: z.string().trim().min(1),
});
