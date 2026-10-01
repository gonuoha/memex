import { z } from "zod";

export const TAG_NAME_MAX_LENGTH = 40;

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(TAG_NAME_MAX_LENGTH, "Tag name is too long")
  .refine((value) => !value.includes(","), "Tag names cannot contain commas");

export const renameTagSchema = z.object({
  tagId: z.string().trim().min(1),
  name: tagNameSchema,
});

export const deleteTagSchema = z.object({
  tagId: z.string().trim().min(1),
});

export function encodeTagNameForPath(name: string): string {
  return encodeURIComponent(name);
}
