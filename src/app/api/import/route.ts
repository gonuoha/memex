import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  MAX_IMPORT_BYTES,
  readImportMultipartFile,
} from "@/lib/import/parse-import-request";
import { runMemexImport, type ImportSummary } from "@/lib/import/run-import";
import { revalidateAppAfterItemMutation } from "@/lib/api/v1/revalidate-app";
import { checkDataImportRateLimit } from "@/lib/rate-limit-user-action";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { getUserIsPro } from "@/lib/db/user";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const EMPTY_SUMMARY: ImportSummary = {
  created: 0,
  skippedDuplicates: 0,
  skippedInvalid: 0,
  skippedUnsupported: 0,
  skippedLimit: 0,
  skippedInvalidCollections: 0,
  collectionsCreated: 0,
  failed: 0,
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const rateLimit = await checkDataImportRateLimit(session.user.id);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const bodyResult = await readImportMultipartFile(request);

  if ("kind" in bodyResult) {
    if (bodyResult.kind === "too_large") {
      return NextResponse.json(
        { error: "File is larger than 5 MB." },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }

    if (bodyResult.kind === "sec_fetch_denied") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { error: "Missing import file." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { file } = bodyResult;

  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 5 MB." },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(await file.text()) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON file." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const isPro = await getUserIsPro(session.user.id);
  let summary: ImportSummary = { ...EMPTY_SUMMARY };

  try {
    const result = await runMemexImport(session.user.id, isPro, payload);

    if ("error" in result) {
      if (result.error === "array_caps_exceeded") {
        return NextResponse.json(
          {
            error:
              "Export exceeds limits (max 10,000 items and 1,000 collections).",
          },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }

      return NextResponse.json(
        { error: "Unrecognized export format." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    summary = result;
  } catch (error) {
    console.error("Import failed:", error);

    return NextResponse.json(summary, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }

  if (summary.created > 0 || summary.collectionsCreated > 0) {
    revalidateAppAfterItemMutation();
  }

  return NextResponse.json(summary, { headers: NO_STORE_HEADERS });
}
