"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/actions/require-session";
import { takeUserAdvisoryLock } from "@/lib/db/advisory-lock";
import { createCollection as createCollectionInDb } from "@/lib/db/collections";
import { activeItemWhere } from "@/lib/db/item-filters";
import {
  createItem as createItemInDb,
  getSystemItemTypes,
} from "@/lib/db/items";
import { updateUserPreferences } from "@/lib/db/settings";
import { getTypeSlug } from "@/lib/item-type-slugs";
import { prisma } from "@/lib/prisma";
import {
  FREE_COLLECTION_LIMIT,
  FREE_ITEM_LIMIT,
} from "@/lib/subscription-limits";
import {
  mergeUserPreferences,
  parseUserPreferences,
} from "@/lib/user-preferences";
import type { ActionResult } from "@/types/actions";

const SAMPLE_COLLECTION_NAME = "Getting started";

type SampleItem = {
  type: "snippet" | "command" | "prompt" | "note" | "link";
  title: string;
  content: string;
  url?: string;
  language?: string;
  tags: string[];
};

const SAMPLE_ITEMS: SampleItem[] = [
  {
    type: "snippet",
    title: "Fetch JSON helper",
    content: `async function fetchJson<T>(url: string): Promise<T> {\n  const response = await fetch(url);\n  if (!response.ok) throw new Error("Request failed");\n  return response.json() as Promise<T>;\n}`,
    language: "typescript",
    tags: ["typescript", "fetch"],
  },
  {
    type: "command",
    title: "Run tests in watch mode",
    content: "npm test -- --watch",
    tags: ["npm", "testing"],
  },
  {
    type: "prompt",
    title: "Code review checklist",
    content:
      "Review this diff for correctness, edge cases, security issues, and test coverage. Suggest concrete improvements.",
    tags: ["ai", "review"],
  },
  {
    type: "note",
    title: "Project conventions",
    content:
      "## Branching\n- `feature/*` for work branches\n- squash merge to main\n\n## Commits\nUse imperative mood and keep subjects under 72 characters.",
    tags: ["team"],
  },
  {
    type: "link",
    title: "Next.js docs",
    url: "https://nextjs.org/docs",
    content: "Official Next.js documentation",
    tags: ["nextjs"],
  },
];

type AddSamplesOutcome = "added" | "already_added" | "item_limit";

export async function dismissOnboarding(): Promise<
  ActionResult<{ dismissed: true }>
> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }

  await updateUserPreferences(sessionResult.userId, {
    onboardingDismissed: true,
  });

  revalidatePath("/dashboard");

  return { success: true, data: { dismissed: true } };
}

export async function addSampleItems(): Promise<
  ActionResult<{ added: boolean }>
> {
  const sessionResult = await requireSession();
  if (!sessionResult.success) {
    return sessionResult;
  }
  const { userId } = sessionResult;

  const itemTypes = await getSystemItemTypes();
  const typeIdByName = new Map(
    itemTypes.map((type) => [type.name.toLowerCase(), type.id]),
  );
  const samples = SAMPLE_ITEMS.flatMap((sample) => {
    const typeId = typeIdByName.get(sample.type);
    return typeId ? [{ ...sample, typeId }] : [];
  });

  const outcome = await prisma.$transaction(
    async (tx): Promise<AddSamplesOutcome> => {
      await takeUserAdvisoryLock(tx, userId);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { isPro: true, userPreferences: true },
      });
      const preferences = parseUserPreferences(user?.userPreferences);

      if (preferences.sampleDataAddedAt) {
        return "already_added";
      }

      const isPro = user?.isPro ?? false;
      const [itemCount, collectionCount] = isPro
        ? [0, 0]
        : await Promise.all([
            tx.item.count({ where: activeItemWhere(userId) }),
            tx.collection.count({ where: { userId } }),
          ]);

      if (!isPro && itemCount + samples.length > FREE_ITEM_LIMIT) {
        return "item_limit";
      }

      const canCreateCollection =
        isPro || collectionCount < FREE_COLLECTION_LIMIT;
      const collection = canCreateCollection
        ? await createCollectionInDb(
            userId,
            {
              name: SAMPLE_COLLECTION_NAME,
              description: "Example items to explore Memex.",
            },
            tx,
          )
        : null;

      for (const sample of samples) {
        await createItemInDb(
          userId,
          {
            typeId: sample.typeId,
            title: sample.title,
            description: null,
            content: sample.content,
            url: sample.url ?? null,
            language: sample.language ?? null,
            fileUrl: null,
            fileName: null,
            fileSize: null,
            tags: sample.tags,
            collectionIds: collection ? [collection.id] : [],
            contentType: "text",
          },
          tx,
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          userPreferences: mergeUserPreferences(preferences, {
            sampleDataAddedAt: new Date().toISOString(),
          }),
        },
      });

      return "added";
    },
  );

  if (outcome === "item_limit") {
    return {
      success: false,
      error: "Free tier item limit reached. Remove items or upgrade to add samples.",
    };
  }

  if (outcome === "already_added") {
    return { success: true, data: { added: false } };
  }

  revalidatePath("/dashboard");
  for (const sample of SAMPLE_ITEMS) {
    revalidatePath(`/items/${getTypeSlug(sample.type)}`);
  }
  revalidatePath("/collections");

  return { success: true, data: { added: true } };
}
