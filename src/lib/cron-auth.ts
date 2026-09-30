import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyCronBearer(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
): "ok" | "missing_secret" | "unauthorized" {
  if (!cronSecret) {
    return "missing_secret";
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "unauthorized";
  }

  const token = authorizationHeader.slice("Bearer ".length);

  return timingSafeEqual(digest(token), digest(cronSecret))
    ? "ok"
    : "unauthorized";
}
