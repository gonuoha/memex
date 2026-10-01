import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { fetchMemexExportData } from "@/lib/export/fetch-export-data";
import { buildMarkdownExportZip } from "@/lib/export/zip";
import { checkDataExportRateLimit } from "@/lib/rate-limit-user-action";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { exportFormatSchema } from "@/lib/validations/export-import";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function exportFilename(extension: "json" | "zip"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `memex-export-${date}.${extension}`;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const rateLimit = await checkDataExportRateLimit(session.user.id);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  const parsed = exportFormatSchema.safeParse(searchParams.get("format"));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid format. Use json or markdown." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const exportData = await fetchMemexExportData(session.user.id);

  if (parsed.data === "json") {
    const body = JSON.stringify(exportData);

    return new NextResponse(body, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename("json")}"`,
      },
    });
  }

  const zip = await buildMarkdownExportZip(exportData);

  return new NextResponse(Buffer.from(zip), {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFilename("zip")}"`,
    },
  });
}
