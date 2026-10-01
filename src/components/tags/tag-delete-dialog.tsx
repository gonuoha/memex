"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteTag } from "@/actions/tags";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import type { UserTagRow } from "@/lib/db/tags";
import { encodeTagNameForPath } from "@/lib/validations/tags";

type TagDeleteDialogProps = {
  tag: UserTagRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TagDeleteDialog({
  tag,
  open,
  onOpenChange,
}: TagDeleteDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDeleting, startDeleting] = useTransition();
  const tagPagePath = `/tags/${encodeTagNameForPath(tag.name)}`;
  const onTagDetailPage = pathname === tagPagePath;

  function handleDeleteConfirm() {
    startDeleting(async () => {
      const result = await deleteTag(tag.id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      toast.success("Tag deleted");

      if (onTagDetailPage) {
        router.push("/tags");
      }

      router.refresh();
    });
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete tag?"
      description={
        <>
          This will remove &ldquo;{tag.name}&rdquo; from all items. Your items
          will not be deleted.
        </>
      }
      isDeleting={isDeleting}
      onConfirm={handleDeleteConfirm}
    />
  );
}
