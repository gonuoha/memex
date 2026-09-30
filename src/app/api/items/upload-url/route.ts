import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildR2ObjectKey,
  parseUploadUrlRequest,
  sanitizeFileName,
  validateUploadFile,
} from "@/lib/file-upload";
import { getUserIsPro, getUserStorageUsageBytes } from "@/lib/db/user";
import { checkUploadUrlRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { createPresignedUploadUrl } from "@/lib/r2/storage";
import {
  isAtStorageLimit,
  isProOnlyItemType,
  storageQuotaErrorMessage,
} from "@/lib/subscription-limits";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkUploadUrlRateLimit(session.user.id);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseUploadUrlRequest(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const { category, fileName, contentType, size } = parsed.data;
  const isPro = await getUserIsPro(session.user.id);

  if (isProOnlyItemType(category)) {
    if (!isPro) {
      return NextResponse.json(
        { error: "File and image uploads require a Pro subscription" },
        { status: 403 },
      );
    }

    const usedBytes = await getUserStorageUsageBytes(session.user.id);

    if (isAtStorageLimit(usedBytes, size, isPro)) {
      return NextResponse.json(
        { error: storageQuotaErrorMessage() },
        { status: 413 },
      );
    }
  }

  const validationError = validateUploadFile(
    {
      name: fileName,
      type: contentType,
      size,
    },
    category,
  );

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const safeName = sanitizeFileName(fileName);
  const key = buildR2ObjectKey(session.user.id, safeName);

  try {
    const uploadUrl = await createPresignedUploadUrl(key, contentType, size);

    return NextResponse.json({
      uploadUrl,
      key,
      fileName: safeName,
      fileSize: size,
    });
  } catch {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
