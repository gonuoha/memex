import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itemType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

import { prisma } from "@/lib/prisma";
import {
  getUserItemTypes,
  resolveItemTypeBySlug,
} from "@/lib/item-types/resolve";

const mockFindMany = vi.mocked(prisma.itemType.findMany);
const mockFindFirst = vi.mocked(prisma.itemType.findFirst);

describe("resolveItemTypeBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves system plural slugs", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "sys-snippet",
      name: "snippet",
      kind: "code",
      slug: null,
      icon: "Code",
      color: "#6366F1",
      isSystem: true,
    } as never);

    const resolved = await resolveItemTypeBySlug("user-1", "snippets");

    expect(resolved?.slug).toBe("snippets");
    expect(resolved?.kind).toBe("code");
  });

  it("resolves a custom slug for the owner", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "custom-1",
      name: "Runbooks",
      kind: "markdown",
      slug: "runbooks",
      icon: "BookOpen",
      color: "#22C55E",
      isSystem: false,
    } as never);

    const resolved = await resolveItemTypeBySlug("user-1", "runbooks");

    expect(resolved?.name).toBe("Runbooks");
    expect(resolved?.isSystem).toBe(false);
  });

  it("returns null for unknown slugs", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const resolved = await resolveItemTypeBySlug("user-1", "missing-type");

    expect(resolved).toBeNull();
  });
});

describe("getUserItemTypes", () => {
  it("orders system types first then custom by name", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "custom",
        name: "Zebra",
        kind: "code",
        slug: "zebra",
        icon: "Code",
        color: "#6366F1",
        isSystem: false,
      },
      {
        id: "snippet",
        name: "snippet",
        kind: "code",
        slug: null,
        icon: "Code",
        color: null,
        isSystem: true,
      },
    ] as never);

    const types = await getUserItemTypes("user-1");

    expect(types.map((type) => type.name)).toEqual(["snippet", "Zebra"]);
  });
});
