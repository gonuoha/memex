import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resetPasswordWithToken } from "@/lib/email/password-reset";
import {
  checkResetPasswordRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validations/password";

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  const rateLimit = await checkResetPasswordRateLimit(request);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const result = await resetPasswordWithToken(parsed.data.token, passwordHash);

  if (result.status === "expired") {
    return NextResponse.json(
      { error: "This password reset link has expired. Please request a new one." },
      { status: 400 },
    );
  }

  if (result.status === "invalid") {
    return NextResponse.json(
      { error: "This password reset link is invalid or has already been used." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
