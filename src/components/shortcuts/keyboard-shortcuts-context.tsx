"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type KeyboardShortcutsContextValue = {
  shortcutsOpen: boolean;
  openShortcutsDialog: () => void;
  closeShortcutsDialog: () => void;
};

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const openShortcutsDialog = useCallback(() => {
    setShortcutsOpen(true);
  }, []);

  const closeShortcutsDialog = useCallback(() => {
    setShortcutsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      shortcutsOpen,
      openShortcutsDialog,
      closeShortcutsDialog,
    }),
    [shortcutsOpen, openShortcutsDialog, closeShortcutsDialog],
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);

  if (!context) {
    throw new Error(
      "useKeyboardShortcuts must be used within KeyboardShortcutsProvider",
    );
  }

  return context;
}
