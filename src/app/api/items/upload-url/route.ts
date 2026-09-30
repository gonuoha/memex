import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildR2ObjectKey,
  parseUploadUrlRequest,
  sanitizeFileName,
  validateUploadFile,
} from "@/lib/file-upload";
import {
  MAX_PENDING_UPLOADS_PER_USER,
  purgeExpiredPendingUploads,
  releasePendingUpload,
  reservePendingUpload,
} from "@/lib/db/pending-uploads";
import { getUserIsPro } from "@/lib/db/user";
import { checkUploadUrlRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { createPresignedUploadUrl } from "@/lib/r2/storage";
import { storageQuotaErrorMessage } from "@/lib/subscription-limits";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function purgeOwnExpiredUploads(userId: string) {
  try {
    await purgeExpiredPendingUploads({ userId, maxBatches: 1 });
  } catch (error) {
    console.error("Failed to purge expired pending uploads:", error);
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = session.user.id;
  const rateLimit = await checkUploadUrlRateLimit(userId);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsed = parseUploadUrlRequest(body);

  if (!parsed.success) {
    return jsonResponse({ error: "Invalid upload request" }, 400);
  }

  const { category, fileName, contentType, size } = parsed.data;

  if (!(await getUserIsPro(userId))) {
    return jsonResponse(
      { error: "File and image uploads require a Pro subscription" },
      403,
    );
  }

  const validationError = validateUploadFile(
    { name: fileName, type: contentType, size },
    category,
  );

  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const safeName = sanitizeFileName(fileName);
  const key = buildR2ObjectKey(userId, safeName);

  await purgeOwnExpiredUploads(userId);

  const reservation = await reservePendingUpload({
    userId,
    key,
    size,
    category,
    isPro: true,
  });

  if (!reservation.success) {
    return reservation.reason === "storage_quota"
      ? jsonResponse({ error: storageQuotaErrorMessage() }, 413)
      : jsonResponse(
          {
            error: `You have ${MAX_PENDING_UPLOADS_PER_USER} unsaved uploads. Save them as items or try again later.`,
          },
          429,
        );
  }

  try {
    const uploadUrl = await createPresignedUploadUrl(key, contentType, size);

    return jsonResponse({ uploadUrl, key, fileName: safeName, fileSize: size });
  } catch (error) {
    console.error("Failed to create presigned upload URL:", error);
    await releasePendingUpload(userId, key);

    return jsonResponse({ error: "Failed to create upload URL" }, 500);
  }
}
