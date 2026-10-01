import { randomBytes } from "crypto";

import { revokeAllActiveApiKeysForUser } from "@/lib/db/api-keys";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validate-email";

const PASSWORD_RESET_PREFIX = "password-reset:";
const TOKEN_EXPIRY_HOURS = 1;

export type PasswordResetTokenResult =
  | { status: "valid"; email: string }
  | { status: "invalid" }
  | { status: "expired" };

function toIdentifier(email: string): string {
  return `${PASSWORD_RESET_PREFIX}${normalizeEmail(email)}`;
}

function emailFromIdentifier(identifier: string): string {
  return identifier.slice(PASSWORD_RESET_PREFIX.length);
}

function isPasswordResetIdentifier(identifier: string): boolean {
  return identifier.startsWith(PASSWORD_RESET_PREFIX);
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const identifier = toIdentifier(email);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return token;
}

export async function validatePasswordResetToken(
  token: string,
): Promise<PasswordResetTokenResult> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || !isPasswordResetIdentifier(record.identifier)) {
    return { status: "invalid" };
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: record.identifier,
          token: record.token,
        },
      },
    });
    return { status: "expired" };
  }

  return { status: "valid", email: emailFromIdentifier(record.identifier) };
}

export async function resetPasswordWithToken(
  token: string,
  passwordHash: string,
): Promise<PasswordResetTokenResult> {
  const validation = await validatePasswordResetToken(token);

  if (validation.status !== "valid") {
    return validation;
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return { status: "invalid" };
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        email: { equals: validation.email, mode: "insensitive" },
      },
      select: { id: true },
    });

    await tx.user.updateMany({
      where: {
        email: { equals: validation.email, mode: "insensitive" },
      },
      data: {
        password: passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    if (user) {
      await revokeAllActiveApiKeysForUser(user.id, tx);
    }

    await tx.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: record.identifier,
          token: record.token,
        },
      },
    });
  });

  return validation;
}
