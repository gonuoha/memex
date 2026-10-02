"use client";

import { createElement } from "react";

import { ItemCreateDialogHost } from "@/components/items/item-create-dialog-host";
import type { SelectableCollection } from "@/components/collections/collection-multi-select";
import { Button } from "@/components/ui/button";
import { getItemTypeIcon, getItemTypeLabel } from "@/lib/item-type-styles";
import type { CreatableItemType } from "@/lib/validations/items";

const TYPE_DESCRIPTIONS: Record<CreatableItemType, string> = {
  snippet: "Reusable code snippets for your projects.",
  prompt: "AI prompts and instructions you reuse often.",
  command: "Shell commands and one-liners worth keeping.",
  note: "Markdown notes and documentation.",
  link: "Bookmarks and references you want handy.",
  file: "Documents and attachments (Pro).",
  image: "Screenshots and visual references (Pro).",
};

function systemDescriptionForName(typeName: string): string | undefined {
  const key = typeName.toLowerCase() as CreatableItemType;
  return TYPE_DESCRIPTIONS[key];
}

type ItemTypeEmptyStateProps = {
  typeName: string;
  creatableType: string;
  typeIcon: string | null;
  isSystem: boolean;
  isPro: boolean;
  itemCount: number;
  collections: SelectableCollection[];
};

export function ItemTypeEmptyState({
  typeName,
  creatableType,
  typeIcon,
  isSystem,
  isPro,
  itemCount,
  collections,
}: ItemTypeEmptyStateProps) {
  const label = isSystem
    ? getItemTypeLabel(typeName, { plural: true, isSystem: true })
    : typeName.trim();
  const description =
    (isSystem && systemDescriptionForName(typeName)) ||
    "Items you save under this custom type.";
  const newLabel = isSystem
    ? `New ${getItemTypeLabel(typeName, { isSystem: true })}`
    : `New ${typeName.trim()}`;

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {createElement(getItemTypeIcon(typeIcon), { className: "size-5" })}
      </div>
      <h3 className="mt-4 text-base font-medium">No {label.toLowerCase()} yet</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      <ItemCreateDialogHost
        isPro={isPro}
        itemCount={itemCount}
        collections={collections}
        defaultType={creatableType}
        trigger={
          <Button type="button" className="mt-6">
            {newLabel}
          </Button>
        }
      />
    </div>
  );
}
