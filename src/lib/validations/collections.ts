import { z } from "zod";

function emptyToNull(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function nullableTrimmedStringMax(maxLength: number) {
  return z.preprocess(
    emptyToNull,
    z.string().trim().max(maxLength).nullable().optional(),
  );
}

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: nullableTrimmedStringMax(1000),
});

export const updateCollectionSchema = createCollectionSchema;
