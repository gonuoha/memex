import { z } from "zod";

import { CUSTOM_CREATABLE_KINDS } from "@/lib/item-types/kinds";
import { CUSTOM_TYPE_COLORS } from "@/lib/item-types/custom-colors";
import { CUSTOM_TYPE_ICON_NAMES } from "@/lib/item-types/custom-icons";
import {
  isReservedItemTypeName,
  isReservedItemTypeSlug,
  slugifyItemTypeName,
} from "@/lib/item-types/slug";

const itemTypeNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(30, "Name must be at most 30 characters")
  .refine((value) => /[a-z0-9]/i.test(value), {
    message: "Name must include at least one letter or number",
  })
  .refine((value) => !isReservedItemTypeName(value), {
    message: "This name is reserved for a system type",
  })
  .refine((value) => !isReservedItemTypeSlug(value.toLowerCase()), {
    message: "This name conflicts with a system type URL",
  })
  .refine((value) => !isReservedItemTypeSlug(slugifyItemTypeName(value)), {
    message: "This name conflicts with a system type URL",
  });

const customKindSchema = z.enum(CUSTOM_CREATABLE_KINDS);

const iconSchema = z.enum(CUSTOM_TYPE_ICON_NAMES);

const colorSchema = z.enum(CUSTOM_TYPE_COLORS);

export const createItemTypeSchema = z.object({
  name: itemTypeNameSchema,
  kind: customKindSchema,
  icon: iconSchema,
  color: colorSchema,
});

export const updateItemTypeSchema = z
  .object({
    name: itemTypeNameSchema.optional(),
    kind: customKindSchema.optional(),
    icon: iconSchema.optional(),
    color: colorSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.kind !== undefined ||
      value.icon !== undefined ||
      value.color !== undefined,
    { message: "No changes provided" },
  );

export const deleteItemTypeSchema = z.object({
  typeId: z.string().trim().min(1),
  moveToTypeId: z.string().trim().min(1).optional(),
});

export type CreateItemTypeInput = z.infer<typeof createItemTypeSchema>;
export type UpdateItemTypeInput = z.infer<typeof updateItemTypeSchema>;
