import { describe, expect, it } from "vitest";

import {
  formatFileSize,
  getFileExtension,
  isOwnedFileUrl,
  parseUploadUrlRequest,
  sanitizeFileName,
  validateUploadFile,
} from "./file-upload";

describe("getFileExtension", () => {
  it("returns the lowercase extension", () => {
    expect(getFileExtension("photo.JPG")).toBe(".jpg");
  });
});

describe("sanitizeFileName", () => {
  it("removes path segments and unsafe characters", () => {
    expect(sanitizeFileName("../../evil/name?.pdf")).toBe("name_.pdf");
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("validateUploadFile", () => {
  it("accepts a valid image", () => {
    const error = validateUploadFile(
      {
        name: "diagram.png",
        type: "image/png",
        size: 1024,
      },
      "image",
    );

    expect(error).toBeNull();
  });

  it("rejects an oversized image", () => {
    const error = validateUploadFile(
      {
        name: "large.png",
        type: "image/png",
        size: 6 * 1024 * 1024,
      },
      "image",
    );

    expect(error).toContain("5 MB");
  });

  it("rejects an unsupported file extension", () => {
    const error = validateUploadFile(
      {
        name: "archive.zip",
        type: "application/zip",
        size: 1024,
      },
      "file",
    );

    expect(error).toContain("Unsupported file type");
  });

  it("accepts a valid document", () => {
    const error = validateUploadFile(
      {
        name: "notes.md",
        type: "text/markdown",
        size: 2048,
      },
      "file",
    );

    expect(error).toBeNull();
  });

  it("accepts markdown files reported as text/plain", () => {
    const error = validateUploadFile(
      {
        name: "notes.md",
        type: "text/plain",
        size: 2048,
      },
      "file",
    );

    expect(error).toBeNull();
  });

  it("accepts yaml files reported as application/octet-stream", () => {
    const error = validateUploadFile(
      {
        name: "config.yml",
        type: "application/octet-stream",
        size: 512,
      },
      "file",
    );

    expect(error).toBeNull();
  });

  it("accepts images with an empty mime type when the extension is valid", () => {
    const error = validateUploadFile(
      {
        name: "diagram.png",
        type: "",
        size: 1024,
      },
      "image",
    );

    expect(error).toBeNull();
  });
});

describe("parseUploadUrlRequest", () => {
  it("accepts a valid presign payload", () => {
    const result = parseUploadUrlRequest({
      category: "image",
      fileName: "photo.png",
      contentType: "image/png",
      size: 1024,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid categories", () => {
    const result = parseUploadUrlRequest({
      category: "video",
      fileName: "clip.mp4",
      contentType: "video/mp4",
      size: 1024,
    });

    expect(result.success).toBe(false);
  });
});

describe("isOwnedFileUrl", () => {
  it("accepts keys under the user's prefix", () => {
    expect(
      isOwnedFileUrl("users/user-1/abc123/notes.pdf", "user-1"),
    ).toBe(true);
  });

  it("rejects keys owned by another user", () => {
    expect(
      isOwnedFileUrl("users/user-2/abc123/notes.pdf", "user-1"),
    ).toBe(false);
  });

  it("rejects path traversal attempts", () => {
    expect(
      isOwnedFileUrl("users/user-1/../user-2/secret.pdf", "user-1"),
    ).toBe(false);
  });
});
