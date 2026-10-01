import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { revokeAllActiveApiKeysForUser } from "@/lib/db/api-keys";
import { prisma } from "@/lib/prisma";
import {
  checkChangePasswordRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validations/password";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkChangePasswordRateLimit(session.user.id);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user?.password) {
    return NextResponse.json(
      { error: "Password change is not available for this account" },
      { status: 400 },
    );
  }

  const isValid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.password,
  );

  if (!isValid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { password: passwordHash, sessionVersion: { increment: 1 } },
    });

    await revokeAllActiveApiKeysForUser(session.user.id, tx);
  });

  return NextResponse.json({ success: true, signOutRequired: true });
}
