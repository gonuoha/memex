export type DetectedImageFormat = "png" | "jpeg" | "gif" | "webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF87_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

function matchesSignature(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[offset + index] === byte);
}

export function detectImageFormat(buffer: Buffer): DetectedImageFormat | null {
  if (matchesSignature(buffer, PNG_SIGNATURE)) {
    return "png";
  }

  if (matchesSignature(buffer, JPEG_SIGNATURE)) {
    return "jpeg";
  }

  if (
    matchesSignature(buffer, GIF87_SIGNATURE) ||
    matchesSignature(buffer, GIF89_SIGNATURE)
  ) {
    return "gif";
  }

  if (
    matchesSignature(buffer, RIFF_SIGNATURE) &&
    matchesSignature(buffer, WEBP_SIGNATURE, 8)
  ) {
    return "webp";
  }

  return null;
}

const MIME_TO_FORMAT: Record<string, DetectedImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function imageMimeMatchesMagicBytes(
  mimeType: string,
  buffer: Buffer,
): boolean {
  const normalizedMime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const expectedFormat = MIME_TO_FORMAT[normalizedMime];

  if (!expectedFormat) {
    return false;
  }

  const detected = detectImageFormat(buffer);

  return detected === expectedFormat;
}
