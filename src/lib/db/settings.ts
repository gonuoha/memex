import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  parseEditorPreferences,
  type EditorPreferences,
} from "@/lib/editor-preferences";
import {
  mergeUserPreferences,
  parseUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";
import { userPreferencesSchema } from "@/lib/validations/user-preferences";
import { getUserItemStats } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";

export type SettingsData = {
  user: {
    email: string;
    hasPassword: boolean;
    isPro: boolean;
    stripeCustomerId: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };
  usage: {
    itemCount: number;
    collectionCount: number;
  };
  editorPreferences: EditorPreferences;
  userPreferences: UserPreferences;
};

export const getUserPreferences = cache(
  async (userId: string): Promise<UserPreferences> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { userPreferences: true },
    });

    return parseUserPreferences(user?.userPreferences);
  },
);

export const getEditorPreferences = cache(
  async (userId: string): Promise<EditorPreferences> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { editorPreferences: true },
    });

    return parseEditorPreferences(user?.editorPreferences);
  },
);

export const getSettingsData = cache(async (): Promise<SettingsData> => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        password: true,
        isPro: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        editorPreferences: true,
        userPreferences: true,
      },
    }),
    getUserItemStats(session.user.id),
  ]);

  if (!user?.email) {
    redirect("/api/auth/signout?callbackUrl=/sign-in");
  }

  return {
    user: {
      email: user.email,
      hasPassword: Boolean(user.password),
      isPro: user.isPro,
      stripeCustomerId: user.stripeCustomerId,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    },
    usage: {
      itemCount: stats.itemCount,
      collectionCount: stats.collectionCount,
    },
    editorPreferences: parseEditorPreferences(user.editorPreferences),
    userPreferences: parseUserPreferences(user.userPreferences),
  };
});

export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId);
  const merged = mergeUserPreferences(current, preferences);
  const parsed = userPreferencesSchema.safeParse(merged);

  if (!parsed.success) {
    throw new Error("Invalid user preferences");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { userPreferences: merged },
    select: { userPreferences: true },
  });

  return parseUserPreferences(updated.userPreferences);
}

export async function updateEditorPreferences(
  userId: string,
  preferences: EditorPreferences,
): Promise<EditorPreferences> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { editorPreferences: preferences },
    select: { editorPreferences: true },
  });

  return parseEditorPreferences(updated.editorPreferences);
}
