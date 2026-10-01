"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type SharedItemCopyButtonProps = {
  text: string;
  label?: string;
};

export function SharedItemCopyButton({
  text,
  label = "Copy",
}: SharedItemCopyButtonProps) {
  const { copy } = useCopyToClipboard();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void copy(text)}
    >
      <Copy />
      {label}
    </Button>
  );
}
