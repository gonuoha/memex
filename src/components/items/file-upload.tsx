"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileIcon, ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  type UploadCategory,
} from "@/lib/file-upload";
import { cn } from "@/lib/utils";

export type UploadedFile = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
};

type FileUploadProps = {
  category: UploadCategory;
  value: UploadedFile | null;
  onChange: (value: UploadedFile | null) => void;
  disabled?: boolean;
};

type UploadUrlResponse = {
  uploadUrl: string;
  key: string;
  fileName: string;
  fileSize: number;
};

class UploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadAbortedError";
  }
}

async function requestUploadUrl(
  file: File,
  category: UploadCategory,
  signal: AbortSignal,
): Promise<UploadUrlResponse> {
  const response = await fetch("/api/items/upload-url", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Upload failed");
  }

  return (await response.json()) as UploadUrlResponse;
}

async function uploadWithProgress(
  file: File,
  category: UploadCategory,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<UploadedFile> {
  const { uploadUrl, key, fileName, fileSize } = await requestUploadUrl(
    file,
    category,
    signal,
  );

  return new Promise<UploadedFile>((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    const xhr = new XMLHttpRequest();
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.addEventListener("abort", () => {
      reject(new UploadAbortedError());
    });
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          fileUrl: key,
          fileName,
          fileSize,
        });
        return;
      }

      reject(new Error("Upload failed"));
    });
    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });
    xhr.send(file);
  });
}

export function FileUpload({
  category,
  value,
  onChange,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];

      if (!file || disabled || isUploading) {
        return;
      }

      if (category === "image") {
        clearPreview();
        setPreviewUrl(URL.createObjectURL(file));
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsUploading(true);
      setProgress(0);

      try {
        const uploaded = await uploadWithProgress(
          file,
          category,
          setProgress,
          controller.signal,
        );
        onChange(uploaded);
        toast.success("File uploaded");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        clearPreview();
        onChange(null);
        toast.error(error instanceof Error ? error.message : "Upload failed");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }

        if (!controller.signal.aborted) {
          setIsUploading(false);
          setProgress(0);
        }
      }
    },
    [category, clearPreview, disabled, isUploading, onChange],
  );

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    clearPreview();
    setIsUploading(false);
    setProgress(0);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleClear() {
    clearPreview();
    onChange(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const Icon = category === "image" ? ImageIcon : FileIcon;
  const label = category === "image" ? "image" : "file";
  const accept =
    category === "image"
      ? ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
      : ".pdf,.txt,.md,.json,.yaml,.yml,.xml,.csv,.toml,.ini";

  if (value) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        {category === "image" && previewUrl ? (
          <div className="overflow-hidden rounded-md border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={value.fileName}
              className="max-h-48 w-full object-contain"
            />
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium">{value.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(value.fileSize)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            disabled={disabled || isUploading}
            aria-label="Remove file"
          >
            <X />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !isUploading) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);

          if (disabled || isUploading) {
            return;
          }

          void handleFiles(event.dataTransfer.files);
        }}
        onClick={() => {
          if (!disabled && !isUploading) {
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center transition-colors",
          isDragging && "border-primary bg-primary/5",
          (disabled || isUploading) && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          {isUploading ? (
            <Upload className="size-4 animate-pulse" />
          ) : (
            <Icon className="size-4" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isUploading ? "Uploading..." : `Drop your ${label} here`}
          </p>
          <p className="text-xs text-muted-foreground">
            {category === "image"
              ? "PNG, JPEG, GIF, or WebP up to 5 MB"
              : "Documents up to 10 MB"}
          </p>
          <p className="text-xs text-muted-foreground">or click to browse</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(event) => {
            void handleFiles(event.target.files);
          }}
        />
      </div>

      {isUploading ? (
        <div className="space-y-2">
          <div
            role="progressbar"
            aria-label={`Uploading ${label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{progress}%</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
