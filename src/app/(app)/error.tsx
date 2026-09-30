"use client";

import { ErrorFallback } from "@/components/shared/error-fallback";

type AppErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AppError({ error, unstable_retry }: AppErrorProps) {
  return (
    <ErrorFallback error={error} onRetry={unstable_retry} className="h-full" />
  );
}
