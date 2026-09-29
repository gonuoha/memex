import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { isEmailVerificationEnabled } from "@/lib/email/config";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { createVerificationToken } from "@/lib/email/verification";
import { prisma } from "@/lib/prisma";
import { checkRegisterRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { registerRequestSchema } from "@/lib/validations/register";

export async function POST(request: Request) {
  const rateLimit = await checkRegisterRateLimit(request);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const verificationRequired = isEmailVerificationEnabled();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      ...(verificationRequired ? {} : { emailVerified: new Date() }),
    },
  });

  if (!verificationRequired) {
    return NextResponse.json({ success: true, verificationRequired: false }, { status: 201 });
  }

  try {
    const token = await createVerificationToken(email);
    await sendVerificationEmail({ email, name, token });
  } catch {
    await prisma.user.delete({ where: { id: user.id } });

    return NextResponse.json(
      { error: "Unable to send verification email. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, verificationRequired: true }, { status: 201 });
}
