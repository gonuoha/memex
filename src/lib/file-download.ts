const INLINE_SAFE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isInlineSafeContentType(contentType: string): boolean {
  return INLINE_SAFE_CONTENT_TYPES.has(normalizeContentType(contentType));
}

export function resolveDownloadContentType(
  contentType: string,
  disposition: "inline" | "attachment",
): string {
  if (disposition === "inline" && normalizeContentType(contentType) === "text/plain") {
    return "text/plain; charset=utf-8";
  }

  return contentType;
}

export function resolveContentDisposition(
  contentType: string,
  forceDownload: boolean,
): "inline" | "attachment" {
  if (forceDownload) {
    return "attachment";
  }

  return isInlineSafeContentType(contentType) ? "inline" : "attachment";
}

function toAsciiFallbackFileName(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

  return ascii.length > 0 ? ascii : "download";
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildContentDispositionHeader(
  disposition: "inline" | "attachment",
  fileName: string,
): string {
  const asciiName = toAsciiFallbackFileName(fileName);
  const encodedName = encodeRfc5987Value(fileName);

  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export const DOWNLOAD_RESPONSE_CSP =
  "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
