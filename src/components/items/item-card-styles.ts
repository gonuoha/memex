export const ITEM_CARD_SURFACE_CLASS =
  "group/item relative min-w-0 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40";

/** Stretched trigger: its `::after` covers the card so siblings with `z-10` stay clickable. */
export const ITEM_CARD_TRIGGER_CLASS =
  "block w-full min-w-0 truncate rounded-sm text-left font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring";
