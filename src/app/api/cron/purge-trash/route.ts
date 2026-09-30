import { NextResponse } from "next/server";

import { verifyCronBearer } from "@/lib/cron-auth";
import { purgeExpiredPendingUploads } from "@/lib/db/pending-uploads";
import { purgeExpiredTrash } from "@/lib/db/trash";

export async function GET(request: Request) {
  const authResult = verifyCronBearer(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );

  if (authResult === "missing_secret") {
    return NextResponse.json(
      { error: "Cron secret is not configured" },
      { status: 500 },
    );
  }

  if (authResult === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purgedCount = await purgeExpiredTrash();
  const purgedUploadCount = await purgeExpiredPendingUploads();

  return NextResponse.json({ purgedCount, purgedUploadCount });
}
