import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { searchCollections, searchItems } from "@/lib/db/search";
import { checkSearchRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { parseSearchQueryParams } from "@/lib/validations/search";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const rateLimit = await checkSearchRateLimit(session.user.id);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseSearchQueryParams(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search parameters" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { q, limit } = parsed.data;

  const [items, collections] = await Promise.all([
    searchItems(session.user.id, q, { limit }),
    searchCollections(session.user.id, q, limit),
  ]);

  return NextResponse.json(
    { items, collections },
    { headers: NO_STORE_HEADERS },
  );
}
