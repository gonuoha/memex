import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getItemById } from "@/lib/db/items";
import {
  buildContentDispositionHeader,
  DOWNLOAD_RESPONSE_CSP,
  resolveContentDisposition,
  resolveDownloadContentType,
} from "@/lib/file-download";
import { getObject } from "@/lib/r2/storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const item = await getItemById(session.user.id, id);

  if (!item?.fileUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const forceDownload =
    new URL(request.url).searchParams.get("download") === "1";

  try {
    const object = await getObject(item.fileUrl);

    if (!object.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const body = object.Body.transformToWebStream();
    const storedContentType = object.ContentType ?? "application/octet-stream";
    const fileName = item.fileName ?? "download";
    const disposition = resolveContentDisposition(
      storedContentType,
      forceDownload,
    );
    const contentType = resolveDownloadContentType(
      storedContentType,
      disposition,
    );

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildContentDispositionHeader(
          disposition,
          fileName,
        ),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": DOWNLOAD_RESPONSE_CSP,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
