"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  addSampleItems,
  dismissOnboarding,
} from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { useSearchShortcutLabel } from "@/hooks/use-search-shortcut-label";
import { cn } from "@/lib/utils";

type OnboardingCardProps = {
  itemCount: number;
  collectionCount: number;
  isPro: boolean;
};

type Step = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
};

export function OnboardingCard({
  itemCount,
  collectionCount,
  isPro,
}: OnboardingCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchShortcutLabel = useSearchShortcutLabel();

  const steps: Step[] = [
    {
      id: "item",
      label: "Create your first item",
      done: itemCount > 0,
    },
    {
      id: "collection",
      label: "Create a collection",
      done: collectionCount > 0,
    },
    {
      id: "search",
      label: `Try search with ${searchShortcutLabel}`,
      done: false,
    },
    {
      id: "ai",
      label: "Explore AI features (Pro)",
      done: isPro,
      href: isPro ? "/settings" : "/upgrade",
    },
  ];

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissOnboarding();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleAddSamples() {
    startTransition(async () => {
      const result = await addSampleItems();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.added ? "Sample items added" : "Sample items already added",
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Get started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A few steps to make Memex yours.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          disabled={isPending}
        >
          Dismiss
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border",
                step.done
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {step.done ? <Check className="size-3" /> : null}
            </span>
            {step.href ? (
              <Link href={step.href} className="hover:underline">
                {step.label}
              </Link>
            ) : (
              <span className={step.done ? "text-muted-foreground" : undefined}>
                {step.label}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleAddSamples}
          disabled={isPending}
        >
          Add sample items
        </Button>
        {!isPro ? (
          <Link
            href="/upgrade"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Upgrade for AI
          </Link>
        ) : null}
      </div>
    </section>
  );
}
