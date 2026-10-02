"use client";

import { useSyncExternalStore } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getItemTypeLabel,
  SYSTEM_ITEM_TYPE_ORDER,
} from "@/lib/item-type-styles";
import {
  formatModifierSymbol,
  isMacUserAgent,
} from "@/lib/shortcuts";

import { ShortcutKbd } from "./shortcut-kbd";

function useIsMac() {
  return useSyncExternalStore(
    () => () => {},
    () => isMacUserAgent(navigator.userAgent),
    () => true,
  );
}

type ShortcutRow = {
  label: string;
  keys: string[];
};

function ShortcutGroup({
  title,
  rows,
  mod,
}: {
  title: string;
  rows: ShortcutRow[];
  mod: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={`${row.label}-${row.keys.join("+")}`}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span>{row.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key, index) => (
                <ShortcutKbd key={`${row.label}-${index}`}>
                  {key === "mod" ? mod : key}
                </ShortcutKbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMac = useIsMac();
  const mod = formatModifierSymbol(isMac);

  const typeRows: ShortcutRow[] = SYSTEM_ITEM_TYPE_ORDER.map((type, index) => ({
    label: getItemTypeLabel(type, { plural: true, isSystem: true }),
    keys: ["g", String(index + 1)],
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(32rem,85vh)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Navigate Memex without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <ShortcutGroup
            title="General"
            mod={mod}
            rows={[
              { label: "Open search", keys: ["mod", "K"] },
              { label: "Open search", keys: ["/"] },
              { label: "Keyboard shortcuts", keys: ["?"] },
              { label: "Toggle sidebar", keys: ["["] },
            ]}
          />

          <ShortcutGroup
            title="Create"
            mod={mod}
            rows={[
              { label: "New item", keys: ["c"] },
              { label: "New collection", keys: ["⇧", "C"] },
            ]}
          />

          <ShortcutGroup
            title="Go to"
            mod={mod}
            rows={[
              { label: "Dashboard", keys: ["g", "d"] },
              { label: "Favorites", keys: ["g", "f"] },
              { label: "Tags", keys: ["g", "l"] },
              { label: "Trash", keys: ["g", "t"] },
              { label: "Collections", keys: ["g", "c"] },
              { label: "Settings", keys: ["g", "s"] },
              ...typeRows,
            ]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
