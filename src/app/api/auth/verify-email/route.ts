import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyEmailToken } from "@/lib/email/verification";

const bodySchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const result = await verifyEmailToken(parsed.data.token);

  if (result.status === "success") {
    return NextResponse.json({ success: true });
  }

  if (result.status === "expired") {
    return NextResponse.json(
      { error: "This verification link has expired.", code: "expired" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: "This verification link is invalid or has already been used.",
      code: "invalid",
    },
    { status: 400 },
  );
}
