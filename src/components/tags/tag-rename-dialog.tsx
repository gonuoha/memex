"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { renameTag } from "@/actions/tags";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserTagRow } from "@/lib/db/tags";
import { encodeTagNameForPath } from "@/lib/validations/tags";

type TagRenameDialogProps = {
  tag: UserTagRow;
  allTags: UserTagRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TagRenameDialog({
  tag,
  allTags,
  open,
  onOpenChange,
}: TagRenameDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState(tag.name);
  const [isSaving, startSaving] = useTransition();
  const tagPagePath = `/tags/${encodeTagNameForPath(tag.name)}`;
  const onTagDetailPage = pathname === tagPagePath;

  const mergeTarget = useMemo(() => {
    const trimmed = name.trim();

    if (!trimmed) {
      return null;
    }

    return (
      allTags.find(
        (entry) =>
          entry.id !== tag.id &&
          entry.name !== tag.name &&
          entry.name.toLowerCase() === trimmed.toLowerCase(),
      ) ?? null
    );
  }, [allTags, name, tag.id, tag.name]);

  const canSave = name.trim().length > 0 && !isSaving;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    startSaving(async () => {
      const result = await renameTag(tag.id, { name: trimmed });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.data.merged
          ? `Merged into “${result.data.name}”`
          : "Tag renamed",
      );
      onOpenChange(false);

      if (onTagDetailPage) {
        router.push(`/tags/${encodeTagNameForPath(result.data.name)}`);
      }

      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename tag</DialogTitle>
            <DialogDescription>
              {mergeTarget
                ? `A tag named “${mergeTarget.name}” already exists. Saving will merge this tag into it and move all items.`
                : "Choose a new name for this tag."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="tag-rename-name">Name</Label>
            <Input
              id="tag-rename-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {isSaving ? "Saving..." : mergeTarget ? "Merge" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
