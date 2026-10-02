import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itemTag: {
      findMany: vi.fn(),
    },
    collection: {
      findMany: vi.fn(),
    },
    itemType: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/item-types/resolve", () => ({
  resolveItemTypeBySlug: vi.fn(),
}));

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveItemTypeBySlug } from "@/lib/item-types/resolve";

import { normalizeSnippet, searchCollections, searchItems } from "./search";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockCollectionFindMany = vi.mocked(prisma.collection.findMany);
const mockItemTagFindMany = vi.mocked(prisma.itemTag.findMany);
const mockResolveItemTypeBySlug = vi.mocked(resolveItemTypeBySlug);

function lastQuery() {
  const [strings, ...values] = mockQueryRaw.mock.calls.at(-1) ?? [];
  const query = Prisma.sql(strings as TemplateStringsArray, ...values);

  return { sql: query.text.replace(/\s+/g, " "), values: query.values };
}

const rawRow = {
  id: "item-2",
  title: "React hook",
  snippet: "useState   example\n",
  type_id: "type-1",
  type_name: "snippet",
  type_icon: "Code",
  type_color: "#000",
  type_is_system: true,
};

describe("searchItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemTagFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([rawRow]);
    mockResolveItemTypeBySlug.mockResolvedValue(null);
  });

  it("lists recent items without text predicates for an empty query", async () => {
    await searchItems("user-1", "", { limit: 20 });

    const { sql, values } = lastQuery();

    expect(sql).toContain('i."userId" = $1');
    expect(sql).toContain('i."deletedAt" IS NULL');
    expect(sql).not.toContain("to_tsquery");
    expect(sql).not.toContain("ILIKE");
    expect(sql).toContain('ORDER BY i."updatedAt" DESC');
    expect(values).toEqual(["user-1", 8]);
  });

  it("parameterizes user input and uses indexable match predicates", async () => {
    const results = await searchItems("user-1", "react'; drop", { limit: 10 });
    const { sql, values } = lastQuery();

    expect(sql).toContain('i."searchVector" @@ to_tsquery(\'simple\', $');
    expect(sql).toContain('i."title" ILIKE $');
    expect(sql).toContain('i."title" % $');
    expect(sql).not.toContain("IS NULL OR");
    expect(sql).not.toContain("drop");
    expect(values).toContain("react:* & drop:*");
    expect(values).toContain("%react'; drop%");
    expect(results[0]).toMatchObject({
      title: "React hook",
      snippet: "useState example",
    });
  });

  it("falls back to title matching when the text has no searchable terms", async () => {
    await searchItems("user-1", "!!!", { limit: 10 });
    const { sql } = lastQuery();

    expect(sql).not.toContain("to_tsquery");
    expect(sql).toContain('i."title" ILIKE $');
  });

  it("applies type aliases and tag filters", async () => {
    mockResolveItemTypeBySlug.mockResolvedValue({
      id: "type-link",
      name: "link",
      slug: "links",
      label: "Links",
      icon: null,
      color: null,
      kind: "link",
      isSystem: true,
    });

    await searchItems("user-1", "type:urls #Docs", { limit: 10 });
    const { sql, values } = lastQuery();

    expect(sql).toContain('it."id" = $2');
    expect(sql).toContain('lower(t."name") = $3');
    expect(values).toEqual(["user-1", "type-link", "docs", 10]);
  });

  it("returns null for unknown custom type slugs", async () => {
    mockResolveItemTypeBySlug.mockResolvedValue(null);

    await searchItems("user-1", "type:someone-elses-slug", { limit: 10 });
    const { sql } = lastQuery();

    expect(sql).toContain("AND 1 = 0");
  });

  it("attaches tags to results", async () => {
    mockItemTagFindMany.mockResolvedValue([
      { itemId: "item-2", tag: { id: "tag-1", name: "react" } },
    ] as never);

    const results = await searchItems("user-1", "react", { limit: 10 });

    expect(results[0]?.tags).toEqual([{ id: "tag-1", name: "react" }]);
  });
});

describe("searchCollections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent collections for an empty query", async () => {
    mockCollectionFindMany.mockResolvedValue([
      {
        id: "col-1",
        name: "Work",
        _count: { items: 3 },
      },
    ] as never);

    const results = await searchCollections("user-1", "", 5);

    expect(results).toEqual([{ id: "col-1", name: "Work", itemCount: 3 }]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns no collections for filter-only queries", async () => {
    const results = await searchCollections("user-1", "type:snippet", 5);

    expect(results).toEqual([]);
    expect(mockCollectionFindMany).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("escapes LIKE wildcards in the name pattern", async () => {
    mockQueryRaw.mockResolvedValue([
      { id: "col-1", name: "100% done", item_count: BigInt(2) },
    ]);

    const results = await searchCollections("user-1", "100%", 5);

    expect(lastQuery().values).toContain("%100\\%%");
    expect(results).toEqual([{ id: "col-1", name: "100% done", itemCount: 2 }]);
  });
});

describe("normalizeSnippet", () => {
  it("collapses whitespace and truncates long text", () => {
    expect(normalizeSnippet("  a\n\n b  ")).toBe("a b");
    expect(normalizeSnippet("   ")).toBeNull();
    expect(normalizeSnippet("x".repeat(200))).toHaveLength(160);
  });
});
