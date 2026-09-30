import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Multipart upload is no longer supported. Use POST /api/items/upload-url." },
    { status: 410 },
  );
}
