"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { setItemCreatePrefill } from "@/components/items/item-create-prefill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommandPalette } from "@/components/search/command-palette-context";
import { getItemTypeLabel } from "@/lib/item-type-styles";
import { isAtItemLimit } from "@/lib/subscription-limits";
import type { CreatableItemType } from "@/lib/validations/items";

const QUICK_TYPES: CreatableItemType[] = ["note", "snippet", "link", "command"];

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type DashboardQuickCaptureProps = {
  isPro: boolean;
  itemCount: number;
};

export function DashboardQuickCapture({
  isPro,
  itemCount,
}: DashboardQuickCaptureProps) {
  const router = useRouter();
  const { openItemCreate } = useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [type, setType] = useState<CreatableItemType>("note");
  const [isTypeChosen, setIsTypeChosen] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();
  const hasValue = value.trim().length > 0;

  function handleValueChange(nextValue: string) {
    setValue(nextValue);

    if (!isTypeChosen) {
      setType(isHttpUrl(nextValue.trim()) ? "link" : "note");
    }
  }

  function reset() {
    setValue("");
    setType("note");
    setIsTypeChosen(false);
  }

  function saveLink(url: string) {
    startSubmitting(async () => {
      const result = await createItem({
        type: "link",
        title: new URL(url).hostname,
        url,
        description: null,
        content: null,
        language: null,
        tags: [],
        collectionIds: [],
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Link saved");
      reset();
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }

    if (isAtItemLimit(itemCount, isPro)) {
      toast.error("Item limit reached. Upgrade to Pro for unlimited items.");
      return;
    }

    if (type === "link" && isHttpUrl(trimmed)) {
      saveLink(trimmed);
      return;
    }

    setItemCreatePrefill(
      type === "link"
        ? { type, url: trimmed }
        : { type, title: trimmed.split("\n")[0].slice(0, 80), content: trimmed },
    );
    openItemCreate();
    reset();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => handleValueChange(event.target.value)}
        placeholder="Quick capture — paste a URL or jot a note…"
        aria-label="Quick capture"
        className="h-9 flex-1"
        disabled={isSubmitting}
      />
      <div className="flex gap-2">
        <Select
          value={type}
          onValueChange={(next) => {
            setType(next as CreatableItemType);
            setIsTypeChosen(true);
          }}
        >
          <SelectTrigger
            className="flex-1 data-[size=default]:h-9 sm:w-32 sm:flex-none"
            aria-label="Capture type"
          >
            <SelectValue>{getItemTypeLabel(type)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {QUICK_TYPES.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {getItemTypeLabel(entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="lg"
          variant={hasValue ? "default" : "secondary"}
          disabled={isSubmitting}
          className="px-4"
        >
          {isSubmitting ? "Saving…" : "Capture"}
        </Button>
      </div>
    </form>
  );
}
