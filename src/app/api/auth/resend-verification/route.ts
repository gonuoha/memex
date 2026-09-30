import { NextResponse } from "next/server";

import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { createVerificationToken } from "@/lib/email/verification";
import { prisma } from "@/lib/prisma";
import { checkResendVerificationRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/validate-email";

type ResendVerificationRequestBody = {
  email?: unknown;
};

const GENERIC_SUCCESS_MESSAGE =
  "If an account with that email exists and is unverified, we've sent a new verification link.";

export async function POST(request: Request) {
  let body: ResendVerificationRequestBody;

  try {
    body = (await request.json()) as ResendVerificationRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const rateLimit = await checkResendVerificationRateLimit(request, email);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { name: true, emailVerified: true, password: true },
  });

  if (user?.password && !user.emailVerified) {
    try {
      const token = await createVerificationToken(email);
      await sendVerificationEmail({ email, name: user.name ?? "", token });
    } catch (error) {
      console.error("Failed to resend verification email:", error);
    }
  }

  return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
}
