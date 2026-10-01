import { SYSTEM_ITEM_TYPE_ORDER } from "@/lib/item-type-styles";
import type { CreatableItemType } from "@/lib/validations/items";

export const SHORTCUT_SEQUENCE_TIMEOUT_MS = 1000;

export type ShortcutAction =
  | { type: "open_search" }
  | { type: "open_shortcuts_help" }
  | { type: "new_item" }
  | { type: "new_collection" }
  | { type: "toggle_sidebar" }
  | { type: "navigate"; href: string }
  | { type: "navigate_item_type"; itemType: CreatableItemType };

export type SequenceState = {
  prefix: string | null;
  expiresAt: number;
};

export const INITIAL_SEQUENCE_STATE: SequenceState = {
  prefix: null,
  expiresAt: 0,
};

const G_NAV_MAP: Record<string, string> = {
  d: "/dashboard",
  f: "/favorites",
  t: "/trash",
  s: "/settings",
  c: "/collections",
};

const G_TYPE_INDEX_MAP = new Map(
  SYSTEM_ITEM_TYPE_ORDER.map((type, index) => [
    String(index + 1),
    type,
  ]),
);

export function isMacUserAgent(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent);
}

export function formatModifierSymbol(isMac: boolean): string {
  return isMac ? "⌘" : "Ctrl";
}

export function isInsideCodeEditor(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(".monaco-editor") !== null;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (target.closest(".monaco-editor, [contenteditable='true'], [role='textbox']")) {
    return true;
  }

  const tag = target.tagName;

  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function hasBlockingModifierKeys(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return event.altKey;
}

export function matchSearchShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  if (event.shiftKey || event.altKey) {
    return false;
  }

  return (
    event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)
  );
}

export function resolveShortcutAction(
  state: SequenceState,
  event: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  now: number,
): { state: SequenceState; action?: ShortcutAction } {
  if (hasBlockingModifierKeys(event)) {
    return { state: INITIAL_SEQUENCE_STATE };
  }

  if (matchSearchShortcut(event)) {
    return {
      state: INITIAL_SEQUENCE_STATE,
      action: { type: "open_search" },
    };
  }

  if (event.metaKey || event.ctrlKey) {
    return { state: INITIAL_SEQUENCE_STATE };
  }

  const key = event.key;
  const lowerKey = key.toLowerCase();
  const activePrefix =
    state.prefix !== null && now <= state.expiresAt ? state.prefix : null;

  if (activePrefix === "g") {
    const href = event.shiftKey ? undefined : G_NAV_MAP[lowerKey];

    if (href) {
      return {
        state: INITIAL_SEQUENCE_STATE,
        action: { type: "navigate", href },
      };
    }

    const itemType = G_TYPE_INDEX_MAP.get(key);

    if (itemType) {
      return {
        state: INITIAL_SEQUENCE_STATE,
        action: { type: "navigate_item_type", itemType },
      };
    }

    return { state: INITIAL_SEQUENCE_STATE };
  }

  if (key === "?") {
    return {
      state: INITIAL_SEQUENCE_STATE,
      action: { type: "open_shortcuts_help" },
    };
  }

  if (event.shiftKey) {
    return lowerKey === "c"
      ? { state: INITIAL_SEQUENCE_STATE, action: { type: "new_collection" } }
      : { state: INITIAL_SEQUENCE_STATE };
  }

  switch (lowerKey) {
    case "/":
      return {
        state: INITIAL_SEQUENCE_STATE,
        action: { type: "open_search" },
      };
    case "[":
      return {
        state: INITIAL_SEQUENCE_STATE,
        action: { type: "toggle_sidebar" },
      };
    case "c":
      return {
        state: INITIAL_SEQUENCE_STATE,
        action: { type: "new_item" },
      };
    case "g":
      return {
        state: {
          prefix: "g",
          expiresAt: now + SHORTCUT_SEQUENCE_TIMEOUT_MS,
        },
      };
    default:
      return { state: INITIAL_SEQUENCE_STATE };
  }
}
