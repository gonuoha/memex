"use client";

import { useState } from "react";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserTagRow } from "@/lib/db/tags";
import { cn } from "@/lib/utils";

import { TagDeleteDialog } from "./tag-delete-dialog";
import { TagRenameDialog } from "./tag-rename-dialog";

type TagRowMenuProps = {
  tag: UserTagRow;
  allTags: UserTagRow[];
};

export function TagRowMenu({ tag, allTags }: TagRowMenuProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors",
            "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Ellipsis className="size-4" />
          <span className="sr-only">Tag actions for {tag.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isRenameOpen ? (
        <TagRenameDialog
          key={tag.id}
          tag={tag}
          allTags={allTags}
          open
          onOpenChange={setIsRenameOpen}
        />
      ) : null}

      <TagDeleteDialog
        tag={tag}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  );
}
