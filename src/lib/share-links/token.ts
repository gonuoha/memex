import { randomBytes } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;

export function generateShareLinkToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

export function isValidShareLinkTokenFormat(token: string): boolean {
  if (token.length < 40 || token.length > 64) {
    return false;
  }

  return /^[A-Za-z0-9_-]+$/.test(token);
}
