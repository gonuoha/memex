"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  emptyTrash,
  permanentlyDeleteItem,
  restoreItem,
} from "@/actions/items";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PaginationControls } from "@/components/layout/pagination-controls";
import { Button } from "@/components/ui/button";
import type { TrashedItem } from "@/lib/db/items";
import { formatShortDateWithYear } from "@/lib/format-date";
import {
  getItemTypeIcon,
  getItemTypeLabel,
  getItemTypeStyles,
} from "@/lib/item-type-styles";
import { cn } from "@/lib/utils";

const TRASH_ROW_LAYOUT =
  "flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-center sm:gap-4";

type TrashListProps = {
  items: TrashedItem[];
  page: number;
  totalPages: number;
};

function getTrashPageHref(page: number) {
  return page <= 1 ? "/trash" : `/trash?page=${page}`;
}

export function TrashList({ items, page, totalPages }: TrashListProps) {
  const router = useRouter();
  const [isEmptyOpen, setIsEmptyOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isEmptying, startEmptying] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const pendingItem = items.find((item) => item.id === pendingDeleteId);
  const isMutating = restoringId !== null || isDeleting || isEmptying;

  function handleRestore(itemId: string) {
    setRestoringId(itemId);

    void restoreItem(itemId)
      .then((result) => {
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        toast.success("Item restored");
        router.refresh();
      })
      .catch(() => toast.error("Failed to restore item"))
      .finally(() => setRestoringId(null));
  }

  function handlePermanentDelete() {
    if (!pendingDeleteId) {
      return;
    }

    startDeleting(async () => {
      const result = await permanentlyDeleteItem(pendingDeleteId);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setPendingDeleteId(null);
      toast.success("Item permanently deleted");
      router.refresh();
    });
  }

  function handleEmptyTrash() {
    startEmptying(async () => {
      const result = await emptyTrash();

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setIsEmptyOpen(false);
      toast.success(
        result.data.deletedCount === 1
          ? "1 item permanently deleted"
          : `${result.data.deletedCount} items permanently deleted`,
      );
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-10 text-center">
        <Trash2
          aria-hidden="true"
          className="mx-auto mb-3 size-8 text-muted-foreground"
        />
        <p className="text-sm font-medium">Trash is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleted items appear here for 30 days before they are removed
          permanently.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isMutating}
          onClick={() => setIsEmptyOpen(true)}
        >
          Empty trash
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="hidden border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:gap-4">
          <span>Item</span>
          <span>Deleted</span>
          <span>Auto-delete</span>
          <span className="text-right">Actions</span>
        </div>

        <ul>
          {items.map((item) => {
            const Icon = getItemTypeIcon(item.type.icon);
            const styles = getItemTypeStyles(item.type.color);
            const isRestoring = restoringId === item.id;

            return (
              <li
                key={item.id}
                className={cn(
                  TRASH_ROW_LAYOUT,
                  "border-b border-border/40 px-4 py-3 last:border-b-0 odd:bg-card even:bg-muted/20",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    aria-hidden="true"
                    className={cn("size-4 shrink-0", styles.textClassName)}
                    style={styles.textStyle}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {getItemTypeLabel(item.type.name, {
                        isSystem: item.type.isSystem ?? true,
                      })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {formatShortDateWithYear(item.deletedAt)}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {item.daysUntilPurge === 0
                    ? "Soon"
                    : `${item.daysUntilPurge} day${item.daysUntilPurge === 1 ? "" : "s"}`}
                </p>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isMutating}
                    aria-busy={isRestoring}
                    aria-label={`Restore ${item.title}`}
                    onClick={() => handleRestore(item.id)}
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                    Restore
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isMutating}
                    aria-label={`Delete ${item.title} forever`}
                    onClick={() => setPendingDeleteId(item.id)}
                  >
                    Delete forever
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {totalPages > 1 ? (
        <div className="mt-8">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            getHref={getTrashPageHref}
          />
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
        title="Delete forever?"
        description={
          pendingItem ? (
            <>
              This will permanently delete &ldquo;{pendingItem.title}&rdquo;.
              This cannot be undone.
            </>
          ) : null
        }
        isDeleting={isDeleting}
        onConfirm={handlePermanentDelete}
      />

      <ConfirmDeleteDialog
        open={isEmptyOpen}
        onOpenChange={setIsEmptyOpen}
        title="Empty trash?"
        description="All items in trash will be permanently deleted. This cannot be undone."
        isDeleting={isEmptying}
        onConfirm={handleEmptyTrash}
      />
    </>
  );
}
