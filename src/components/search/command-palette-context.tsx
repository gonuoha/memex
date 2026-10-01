"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type CreateDialogHandlers = {
  openItemCreate: () => void;
  openCollectionCreate: () => void;
};

type CommandPaletteContextValue = {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  registerCreateHandlers: (handlers: CreateDialogHandlers | null) => void;
  openItemCreate: () => void;
  openCollectionCreate: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createHandlersRef = useRef<CreateDialogHandlers | null>(null);

  const openPalette = useCallback(() => {
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
  }, []);

  const togglePalette = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const registerCreateHandlers = useCallback(
    (handlers: CreateDialogHandlers | null) => {
      createHandlersRef.current = handlers;
    },
    [],
  );

  const openItemCreate = useCallback(() => {
    createHandlersRef.current?.openItemCreate();
  }, []);

  const openCollectionCreate = useCallback(() => {
    createHandlersRef.current?.openCollectionCreate();
  }, []);

  const value = useMemo(
    () => ({
      open,
      openPalette,
      closePalette,
      togglePalette,
      registerCreateHandlers,
      openItemCreate,
      openCollectionCreate,
    }),
    [
      open,
      openPalette,
      closePalette,
      togglePalette,
      registerCreateHandlers,
      openItemCreate,
      openCollectionCreate,
    ],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);

  if (!context) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  }

  return context;
}
