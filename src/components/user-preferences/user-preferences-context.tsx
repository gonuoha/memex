"use client";

import { createContext, useContext } from "react";

import {
  DEFAULT_USER_PREFERENCES,
  type TypeColorPosition,
  type UserPreferences,
} from "@/lib/user-preferences";

type UserPreferencesContextValue = {
  typeColorPosition: TypeColorPosition;
  showLinkFavicons: boolean;
};

const UserPreferencesContext =
  createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({
  children,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialPreferences: UserPreferences;
}) {
  return (
    <UserPreferencesContext.Provider
      value={{
        typeColorPosition: initialPreferences.typeColorPosition,
        showLinkFavicons: initialPreferences.showLinkFavicons,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useTypeColorPosition(): TypeColorPosition {
  const context = useContext(UserPreferencesContext);

  return (
    context?.typeColorPosition ?? DEFAULT_USER_PREFERENCES.typeColorPosition
  );
}

export function useShowLinkFavicons(): boolean {
  const context = useContext(UserPreferencesContext);

  return context?.showLinkFavicons ?? DEFAULT_USER_PREFERENCES.showLinkFavicons;
}
