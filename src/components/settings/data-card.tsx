"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageSection } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import type { ImportSummary } from "@/lib/import/run-import";
import { cn } from "@/lib/utils";

export function DataCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport(format: "json" | "markdown") {
    setIsExporting(true);

    try {
      const response = await fetch(`/api/export?format=${format}`);

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(data?.error ?? "Export failed");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ??
        `memex-export-${new Date().toISOString().slice(0, 10)}.${
          format === "json" ? "json" : "zip"
        }`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(file: File) {
    setIsImporting(true);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");

      if (!isJson) {
        if (response.status === 413) {
          toast.error("File is larger than 5 MB.");
          return;
        }

        toast.error("Import failed");
        return;
      }

      const data = (await response.json()) as ImportSummary & { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Import failed");
        if (response.status === 500 && data.created !== undefined) {
          setSummary(data);
        }
        return;
      }

      setSummary(data);
      toast.success("Import finished");
      router.refresh();
    } catch {
      toast.error("Import failed");
    } finally {
      setIsImporting(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void handleImport(file);
    }
  }

  return (
    <PageSection
      title="Data"
      description="Export your library as JSON or Markdown (ZIP). Import JSON exports to restore text items (original created/updated dates are not preserved). File and image binaries are not included in exports."
      contentClassName="space-y-6"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isExporting}
          onClick={() => void handleExport("json")}
        >
          <Download />
          Export JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isExporting}
          onClick={() => void handleExport("markdown")}
        >
          <Download />
          Export Markdown
        </Button>
      </div>

      <div className="space-y-3">
        <label
          htmlFor="memex-import-file"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/20 hover:bg-muted/40",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="size-8 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">
            {isImporting ? "Importing…" : "Drop a JSON export or click to browse"}
          </span>
          <span className="text-xs text-muted-foreground">Max 5 MB</span>
          <input
            ref={inputRef}
            id="memex-import-file"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={isImporting}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
            }}
          />
        </label>

        {summary ? (
          <div
            className="rounded-lg border border-border bg-muted/30 p-4 text-sm"
            role="status"
          >
            <p className="font-medium">Import summary</p>
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              <li>{summary.created} items created</li>
              <li>{summary.collectionsCreated} collections created</li>
              <li>{summary.skippedDuplicates} duplicates skipped</li>
              <li>{summary.skippedInvalid} invalid entries skipped</li>
              <li>
                {summary.skippedInvalidCollections} invalid collections skipped
              </li>
              <li>{summary.skippedUnsupported} file/image entries skipped</li>
              <li>{summary.skippedLimit} skipped due to plan limits</li>
              <li>{summary.failed} failed</li>
            </ul>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}
