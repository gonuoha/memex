"use client";

import { createContext, useContext } from "react";

import type { ResolvedItemType } from "@/lib/item-types/types";

const ItemTypesContext = createContext<ResolvedItemType[] | null>(null);

export function ItemTypesProvider({
  itemTypes,
  children,
}: {
  itemTypes: ResolvedItemType[];
  children: React.ReactNode;
}) {
  return (
    <ItemTypesContext.Provider value={itemTypes}>
      {children}
    </ItemTypesContext.Provider>
  );
}

export function useItemTypes(): ResolvedItemType[] {
  const value = useContext(ItemTypesContext);

  if (!value) {
    return [];
  }

  return value;
}
