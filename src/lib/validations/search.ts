import { z } from "zod";

export const searchQueryParamsSchema = z.object({
  q: z.string().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export type SearchQueryParams = z.infer<typeof searchQueryParamsSchema>;

export function parseSearchQueryParams(searchParams: URLSearchParams) {
  return searchQueryParamsSchema.safeParse({
    q: searchParams.get("q") ?? "",
    limit: searchParams.get("limit") ?? undefined,
  });
}
