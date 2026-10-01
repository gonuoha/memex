import type { CreatableItemType } from "@/lib/validations/items";

export type ItemCreatePrefill = {
  type?: CreatableItemType;
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  language?: string;
  tags?: string;
};

/** Browser-only handoff; the window guard keeps server renders from sharing state across requests. */
let pendingPrefill: ItemCreatePrefill | null = null;

export function setItemCreatePrefill(prefill: ItemCreatePrefill): void {
  if (typeof window === "undefined") {
    return;
  }

  pendingPrefill = prefill;
}

export function consumeItemCreatePrefill(): ItemCreatePrefill | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = pendingPrefill;
  pendingPrefill = null;
  return value;
}
