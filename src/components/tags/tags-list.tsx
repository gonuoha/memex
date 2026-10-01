"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import type { UserTagRow } from "@/lib/db/tags";
import { encodeTagNameForPath } from "@/lib/validations/tags";

import { TagRowMenu } from "./tag-row-menu";

type TagsListProps = {
  tags: UserTagRow[];
};

export function TagsList({ tags }: TagsListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return tags;
    }

    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, tags]);

  if (tags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tags yet. Add tags when creating or editing items.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tags…"
        aria-label="Search tags"
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags match your search.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-2 px-3 py-2.5 sm:px-4"
            >
              <Link
                href={`/tags/${encodeTagNameForPath(tag.name)}`}
                className="min-w-0 flex-1 truncate rounded-sm text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {tag.name}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {tag.itemCount === 1 ? "1 item" : `${tag.itemCount} items`}
              </span>
              <TagRowMenu tag={tag} allTags={tags} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
