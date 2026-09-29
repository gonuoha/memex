import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validate-email";

const VERIFY_EMAIL_PREFIX = "verify:";
const TOKEN_EXPIRY_HOURS = 24;

export type VerifyEmailResult =
  | { status: "success" }
  | { status: "invalid" }
  | { status: "expired" };

function toIdentifier(email: string): string {
  return `${VERIFY_EMAIL_PREFIX}${normalizeEmail(email)}`;
}

function emailFromIdentifier(identifier: string): string {
  if (identifier.startsWith(VERIFY_EMAIL_PREFIX)) {
    return identifier.slice(VERIFY_EMAIL_PREFIX.length);
  }

  return identifier;
}

function isVerificationIdentifier(identifier: string): boolean {
  return (
    identifier.startsWith(VERIFY_EMAIL_PREFIX) ||
    (!identifier.startsWith("password-reset:") && identifier.includes("@"))
  );
}

export async function createVerificationToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const identifier = toIdentifier(email);

  await prisma.verificationToken.deleteMany({
    where: {
      OR: [{ identifier }, { identifier: normalizeEmail(email) }],
    },
  });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return token;
}

export async function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || !isVerificationIdentifier(record.identifier)) {
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

  const email = emailFromIdentifier(record.identifier);

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { email: { equals: email, mode: "insensitive" } },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: record.identifier,
          token: record.token,
        },
      },
    }),
  ]);

  return { status: "success" };
}
