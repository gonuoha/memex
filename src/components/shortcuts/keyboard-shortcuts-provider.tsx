"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useCommandPalette } from "@/components/search/command-palette-context";
import { isProOnlyItemType } from "@/lib/subscription-limits";
import { getTypeSlug } from "@/lib/item-type-slugs";
import {
  INITIAL_SEQUENCE_STATE,
  isEditableKeyboardTarget,
  isInsideCodeEditor,
  matchSearchShortcut,
  resolveShortcutAction,
  type SequenceState,
} from "@/lib/shortcuts";

import { useSidebar } from "../dashboard/sidebar-context";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcuts,
} from "./keyboard-shortcuts-context";

function isBlockingDialogOpen(shortcutsOpen: boolean, paletteOpen: boolean) {
  if (shortcutsOpen || paletteOpen) {
    return true;
  }

  return (
    document.querySelector(
      '[role="dialog"][data-open], [role="alertdialog"][data-open], [role="menu"][data-open], [role="listbox"][data-open]',
    ) !== null
  );
}

function KeyboardShortcutsListener({
  isPro,
}: {
  isPro: boolean;
}) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const {
    open,
    openPalette,
    closePalette,
    openItemCreate,
    openCollectionCreate,
  } = useCommandPalette();
  const { shortcutsOpen, openShortcutsDialog } = useKeyboardShortcuts();
  const sequenceRef = useRef<SequenceState>(INITIAL_SEQUENCE_STATE);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      if (matchSearchShortcut(event) && !isInsideCodeEditor(event.target)) {
        event.preventDefault();

        if (open) {
          closePalette();
        } else if (!shortcutsOpen) {
          openPalette();
        }

        return;
      }

      if (
        isEditableKeyboardTarget(event.target) ||
        isBlockingDialogOpen(shortcutsOpen, open)
      ) {
        return;
      }

      const now = Date.now();
      const { state, action } = resolveShortcutAction(
        sequenceRef.current,
        event,
        now,
      );

      sequenceRef.current = state;

      if (!action) {
        return;
      }

      event.preventDefault();

      switch (action.type) {
        case "open_search":
          openPalette();
          break;
        case "open_shortcuts_help":
          openShortcutsDialog();
          break;
        case "new_item":
          openItemCreate();
          break;
        case "new_collection":
          openCollectionCreate();
          break;
        case "toggle_sidebar":
          toggleSidebar();
          break;
        case "navigate":
          router.push(action.href);
          break;
        case "navigate_item_type": {
          if (isProOnlyItemType(action.itemType) && !isPro) {
            router.push("/upgrade");
            break;
          }

          router.push(`/items/${getTypeSlug(action.itemType)}`);
          break;
        }
        default:
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isPro,
    closePalette,
    open,
    openCollectionCreate,
    openItemCreate,
    openPalette,
    openShortcutsDialog,
    router,
    shortcutsOpen,
    toggleSidebar,
  ]);

  return null;
}

export function AppKeyboardShortcuts({
  children,
  isPro,
}: {
  children: React.ReactNode;
  isPro: boolean;
}) {
  const { shortcutsOpen, openShortcutsDialog, closeShortcutsDialog } =
    useKeyboardShortcuts();

  return (
    <>
      <KeyboardShortcutsListener isPro={isPro} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            openShortcutsDialog();
            return;
          }

          closeShortcutsDialog();
        }}
      />
      {children}
    </>
  );
}

export function AppKeyboardShortcutsRoot({
  children,
  isPro,
}: {
  children: React.ReactNode;
  isPro: boolean;
}) {
  return (
    <KeyboardShortcutsProvider>
      <AppKeyboardShortcuts isPro={isPro}>{children}</AppKeyboardShortcuts>
    </KeyboardShortcutsProvider>
  );
}
