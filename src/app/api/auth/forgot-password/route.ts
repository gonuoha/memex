import { NextResponse } from "next/server";

import { createPasswordResetToken } from "@/lib/email/password-reset";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import { prisma } from "@/lib/prisma";
import { checkForgotPasswordRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/validate-email";

type ForgotPasswordRequestBody = {
  email?: string;
};

const GENERIC_SUCCESS_MESSAGE =
  "If an account with that email exists, we've sent password reset instructions.";

export async function POST(request: Request) {
  const rateLimit = await checkForgotPasswordRateLimit(request);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: ForgotPasswordRequestBody;

  try {
    body = (await request.json()) as ForgotPasswordRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { name: true, password: true },
  });

  if (user?.password) {
    try {
      const token = await createPasswordResetToken(email);
      await sendPasswordResetEmail({ email, name: user.name, token });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  }

  return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
}
