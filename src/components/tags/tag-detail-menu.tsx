"use client";

import type { UserTagRow } from "@/lib/db/tags";

import { TagRowMenu } from "./tag-row-menu";

type TagDetailMenuProps = {
  tag: UserTagRow;
  allTags: UserTagRow[];
};

export function TagDetailMenu({ tag, allTags }: TagDetailMenuProps) {
  return <TagRowMenu tag={tag} allTags={allTags} />;
}
