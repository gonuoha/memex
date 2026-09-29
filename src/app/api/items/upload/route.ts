import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildR2ObjectKey,
  sanitizeFileName,
  validateUploadFile,
  type UploadCategory,
} from "@/lib/file-upload";
import { getUserIsPro, getUserStorageUsageBytes } from "@/lib/db/user";
import { imageMimeMatchesMagicBytes } from "@/lib/image-magic-bytes";
import { uploadObject } from "@/lib/r2/storage";
import {
  isAtStorageLimit,
  isProOnlyItemType,
  storageQuotaErrorMessage,
} from "@/lib/subscription-limits";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const categoryValue = formData.get("category");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (categoryValue !== "image" && categoryValue !== "file") {
    return NextResponse.json({ error: "Invalid upload category" }, { status: 400 });
  }

  const category = categoryValue as UploadCategory;
  const isPro = await getUserIsPro(session.user.id);

  if (isProOnlyItemType(category)) {
    if (!isPro) {
      return NextResponse.json(
        { error: "File and image uploads require a Pro subscription" },
        { status: 403 },
      );
    }

    const usedBytes = await getUserStorageUsageBytes(session.user.id);

    if (isAtStorageLimit(usedBytes, file.size, isPro)) {
      return NextResponse.json(
        { error: storageQuotaErrorMessage() },
        { status: 413 },
      );
    }
  }

  const validationError = validateUploadFile(
    {
      name: file.name,
      type: file.type,
      size: file.size,
    },
    category,
  );

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (category === "image" && !imageMimeMatchesMagicBytes(file.type, buffer)) {
    return NextResponse.json(
      { error: "File contents do not match the declared image type" },
      { status: 400 },
    );
  }

  const fileName = sanitizeFileName(file.name);
  const key = buildR2ObjectKey(session.user.id, fileName);

  try {
    await uploadObject(key, buffer, file.type);
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    fileUrl: key,
    fileName,
    fileSize: file.size,
  });
}
