const DEFAULT_CALLBACK_URL = "/dashboard";

function hasControlCharacter(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

export function sanitizeCallbackUrl(
  callbackUrl: string | null | undefined,
): string {
  if (!callbackUrl) {
    return DEFAULT_CALLBACK_URL;
  }

  const trimmed = callbackUrl.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_CALLBACK_URL;
  }

  // Browsers strip tabs/newlines while parsing, so "/\t/evil.com" becomes "//evil.com".
  if (
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    hasControlCharacter(trimmed)
  ) {
    return DEFAULT_CALLBACK_URL;
  }

  return trimmed;
}
