"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  onRetry: () => void;
  className?: string;
};

export function ErrorFallback({ error, onRetry, className }: ErrorFallbackProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6 text-center",
        className,
      )}
    >
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while loading this page.
      </p>
      <Button type="button" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
