export type UploadCategory = "image" | "file";

const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
]);

const FILE_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".csv",
  ".toml",
  ".ini",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const FILE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/x-yaml",
  "text/yaml",
  "application/xml",
  "text/xml",
  "text/csv",
  "application/toml",
]);

export type UploadFileDescriptor = {
  name: string;
  type: string;
  size: number;
};

export function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex === -1) {
    return "";
  }

  return fileName.slice(dotIndex).toLowerCase();
}

export function sanitizeFileName(fileName: string) {
  const baseName = fileName.split(/[/\\]/).pop() ?? "upload";

  return baseName.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "upload";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isMimeAcceptable(
  mimeType: string,
  extension: string,
  category: UploadCategory,
) {
  const allowedExtensions =
    category === "image" ? IMAGE_EXTENSIONS : FILE_EXTENSIONS;
  const allowedMimeTypes =
    category === "image" ? IMAGE_MIME_TYPES : FILE_MIME_TYPES;

  if (!mimeType) {
    return allowedExtensions.has(extension);
  }

  if (allowedMimeTypes.has(mimeType)) {
    return true;
  }

  if (category === "file" && allowedExtensions.has(extension)) {
    return mimeType === "text/plain" || mimeType === "application/octet-stream";
  }

  return false;
}

export function isOwnedFileUrl(fileUrl: string, userId: string) {
  const prefix = `users/${userId}/`;

  return (
    fileUrl.startsWith(prefix) &&
    !fileUrl.includes("..") &&
    fileUrl.length > prefix.length
  );
}

export function validateUploadFile(
  file: UploadFileDescriptor,
  category: UploadCategory,
): string | null {
  const extension = getFileExtension(file.name);
  const allowedExtensions =
    category === "image" ? IMAGE_EXTENSIONS : FILE_EXTENSIONS;
  const maxSize =
    category === "image" ? IMAGE_MAX_SIZE_BYTES : FILE_MAX_SIZE_BYTES;
  const maxSizeLabel = category === "image" ? "5 MB" : "10 MB";

  if (!allowedExtensions.has(extension)) {
    return `Unsupported file type. Allowed extensions: ${[...allowedExtensions].join(", ")}`;
  }

  if (!isMimeAcceptable(file.type, extension, category)) {
    return "Unsupported file MIME type";
  }

  if (file.size <= 0) {
    return "File is empty";
  }

  if (file.size > maxSize) {
    return `File exceeds the ${maxSizeLabel} limit`;
  }

  return null;
}

export function buildR2ObjectKey(userId: string, fileName: string) {
  const safeName = sanitizeFileName(fileName);

  return `users/${userId}/${crypto.randomUUID()}/${safeName}`;
}
