"use client";

import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ItemDetail } from "@/lib/db/items";
import { getItemCopyText } from "@/lib/item-copy";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

type ItemCopyButtonProps = {
  itemId: string;
  className?: string;
};

export function ItemCopyButton({ itemId, className }: ItemCopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  async function handleCopy(event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    try {
      const response = await fetch(`/api/items/${itemId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch item");
      }

      const item = (await response.json()) as ItemDetail;
      await copy(getItemCopyText(item));
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy item"}
      title={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
