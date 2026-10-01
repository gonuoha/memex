"use client";

import { cloneElement, isValidElement, useState } from "react";

import type { SelectableCollection } from "@/components/collections/collection-multi-select";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { setItemCreatePrefill } from "@/components/items/item-create-prefill";
import type { CreatableItemType } from "@/lib/validations/items";

type ItemCreateDialogHostProps = {
  isPro: boolean;
  itemCount: number;
  collections: SelectableCollection[];
  defaultType?: CreatableItemType;
  prefillOnOpen?: {
    type?: CreatableItemType;
    title?: string;
    content?: string;
    url?: string;
  };
  trigger: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
};

export function ItemCreateDialogHost({
  isPro,
  itemCount,
  collections,
  defaultType,
  prefillOnOpen,
  trigger,
}: ItemCreateDialogHostProps) {
  const [open, setOpen] = useState(false);

  function handleOpen(event: React.MouseEvent) {
    trigger.props.onClick?.(event);
    if (prefillOnOpen) {
      setItemCreatePrefill(prefillOnOpen);
    }
    setOpen(true);
  }

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: handleOpen,
      })
    : trigger;

  return (
    <>
      {triggerElement}
      <ItemCreateDialog
        open={open}
        onOpenChange={setOpen}
        isPro={isPro}
        itemCount={itemCount}
        defaultType={defaultType}
        collections={collections}
      />
    </>
  );
}
