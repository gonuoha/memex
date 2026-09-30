"use client";

import { ErrorFallback } from "@/components/shared/error-fallback";

type RootErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function RootError({ error, unstable_retry }: RootErrorProps) {
  return (
    <ErrorFallback
      error={error}
      onRetry={unstable_retry}
      className="min-h-svh"
    />
  );
}
