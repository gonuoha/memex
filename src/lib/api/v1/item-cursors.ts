import { createHash } from "node:crypto";

import type { ApiV1ListItemsQuery } from "@/lib/validations/api-v1";

export const API_V1_MAX_SEARCH_OFFSET = 1000;

export type ApiV1KeysetCursor = {
  k: "ks";
  u: string;
  id: string;
  h: string;
};

export type ApiV1SearchCursor = {
  k: "q";
  o: number;
  h: string;
};

export type ApiV1ListCursor = ApiV1KeysetCursor | ApiV1SearchCursor;

export function hashApiV1ListFilters(query: ApiV1ListItemsQuery): string {
  const payload = JSON.stringify({
    type: query.type ?? null,
    tag: query.tag?.toLowerCase() ?? null,
    collection: query.collection ?? null,
    q: query.q ?? null,
  });

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function encodeApiV1ListCursor(cursor: ApiV1ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeApiV1ListCursor(value: string): ApiV1ListCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as ApiV1ListCursor;

    if (parsed.k === "ks") {
      if (
        typeof parsed.id !== "string" ||
        typeof parsed.u !== "string" ||
        typeof parsed.h !== "string" ||
        Number.isNaN(Date.parse(parsed.u))
      ) {
        return null;
      }

      return parsed;
    }

    if (parsed.k === "q") {
      if (
        typeof parsed.h !== "string" ||
        typeof parsed.o !== "number" ||
        !Number.isInteger(parsed.o) ||
        parsed.o < 0
      ) {
        return null;
      }

      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
