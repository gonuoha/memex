"use client";

import { createElement, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createItemType,
  deleteItemType,
  updateItemType,
} from "@/actions/item-types";
import { PageSection } from "@/components/layout/page-container";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemTypeListEntry } from "@/lib/db/item-types";
import { CUSTOM_CREATABLE_KINDS } from "@/lib/item-types/kinds";
import { CUSTOM_TYPE_COLORS, getCustomTypeColorLabel } from "@/lib/item-types/custom-colors";
import { CUSTOM_TYPE_ICON_NAMES } from "@/lib/item-types/custom-icons";
import {
  ItemTypeIconRadioGroup,
  ItemTypeOptionRadioGroup,
} from "@/components/settings/item-type-option-radio-group";
import {
  getItemTypeIcon,
  getItemTypeLabel,
  getItemTypeStyles,
  sortItemTypesBySystemOrder,
} from "@/lib/item-type-styles";
import { cn } from "@/lib/utils";

type ItemTypesCardProps = {
  isPro: boolean;
  initialTypes: ItemTypeListEntry[];
};

type FormState = {
  name: string;
  kind: (typeof CUSTOM_CREATABLE_KINDS)[number];
  icon: (typeof CUSTOM_TYPE_ICON_NAMES)[number];
  color: (typeof CUSTOM_TYPE_COLORS)[number];
};

const defaultForm: FormState = {
  name: "",
  kind: "code",
  icon: "Code",
  color: CUSTOM_TYPE_COLORS[0],
};

function TypePreviewChip({
  name,
  icon,
  color,
}: {
  name: string;
  icon: string | null;
  color: string | null;
}) {
  const styles = getItemTypeStyles(color);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        styles.bgClassName,
      )}
      style={styles.bgStyle}
    >
      {createElement(getItemTypeIcon(icon), {
        className: cn("size-3.5", styles.textClassName),
        style: styles.textStyle,
      })}
      <span style={styles.textStyle}>{name || "Preview"}</span>
    </span>
  );
}

export function ItemTypesCard({ isPro, initialTypes: types }: ItemTypesCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<ItemTypeListEntry | null>(
    null,
  );
  const [moveToTypeId, setMoveToTypeId] = useState<string>("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const { systemTypes, customTypes } = useMemo(() => {
    const system = sortItemTypesBySystemOrder(
      types.filter((type) => type.isSystem),
    );
    const custom = types
      .filter((type) => !type.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { systemTypes: system, customTypes: custom };
  }, [types]);

  const moveTargets = useMemo(() => {
    if (!deleteTarget) {
      return [];
    }

    return types.filter(
      (type) =>
        type.id !== deleteTarget.id && type.kind === deleteTarget.kind,
    );
  }, [deleteTarget, types]);

  function openCreateDialog() {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }

    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEditDialog(type: ItemTypeListEntry) {
    setEditingId(type.id);
    setForm({
      name: type.name,
      kind: type.kind as FormState["kind"],
      icon: (type.icon as FormState["icon"]) ?? "Code",
      color: (type.color as FormState["color"]) ?? CUSTOM_TYPE_COLORS[0],
    });
    setDialogOpen(true);
  }

  function handleSave() {
    startSaving(async () => {
      const payload = {
        name: form.name,
        kind: form.kind,
        icon: form.icon,
        color: form.color,
      };

      const result = editingId
        ? await updateItemType(editingId, payload)
        : await createItemType(payload);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(editingId ? "Item type updated" : "Item type created");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    startDeleting(async () => {
      const result = await deleteItemType(deleteTarget.id, {
        typeId: deleteTarget.id,
        moveToTypeId: moveToTypeId || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Deleted “${result.data.name}”`);
      setDeleteTarget(null);
      setMoveToTypeId("");
      router.refresh();
    });
  }

  return (
    <PageSection
      title="Item types"
      description="System types are built in. Pro users can add custom types with their own icon, color, and editor behaviour."
      action={
        <Button type="button" size="sm" onClick={openCreateDialog}>
          <Plus />
          New type
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            System
          </p>
          <ul className="divide-y rounded-lg border">
            {systemTypes.map((type) => {
              const Icon = getItemTypeIcon(type.icon);
              const styles = getItemTypeStyles(type.color);

              return (
                <li
                  key={type.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon
                      className={cn("size-4 shrink-0", styles.textClassName)}
                      style={styles.textStyle}
                    />
                    <span className="truncate font-medium">
                      {getItemTypeLabel(type.name, {
                        plural: true,
                        isSystem: type.isSystem,
                      })}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {type.itemCount} items
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Custom
            </p>
            {!isPro ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                Pro
              </Badge>
            ) : null}
          </div>

          {customTypes.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No custom types yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {customTypes.map((type) => {
                const Icon = getItemTypeIcon(type.icon);
                const styles = getItemTypeStyles(type.color);

                return (
                  <li
                    key={type.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon
                        className={cn("size-4 shrink-0", styles.textClassName)}
                        style={styles.textStyle}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {type.kind} · /items/{type.slug}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                        {type.itemCount}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${type.name}`}
                        onClick={() => openEditDialog(type)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${type.name}`}
                        onClick={() => {
                          setDeleteTarget(type);
                          setMoveToTypeId("");
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit item type" : "New item type"}
            </DialogTitle>
            <DialogDescription>
              Name appears in lists; kind controls which fields items use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-type-name">Name</Label>
              <Input
                id="item-type-name"
                value={form.name}
                maxLength={30}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, name: event.target.value }))
                }
              />
            </div>

            {!editingId ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Kind</legend>
                {CUSTOM_CREATABLE_KINDS.map((kind) => (
                  <label
                    key={kind}
                    className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 has-checked:border-primary"
                  >
                    <input
                      type="radio"
                      name="item-type-kind"
                      value={kind}
                      checked={form.kind === kind}
                      onChange={() => setForm((previous) => ({ ...previous, kind }))}
                      className="mt-1"
                    />
                    <span className="text-sm">
                      {kind === "code"
                        ? "Code (syntax-highlighted editor)"
                        : kind === "markdown"
                          ? "Markdown (rich text)"
                          : "Link (URL + notes)"}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <div className="space-y-2">
              <Label>Icon</Label>
              <ItemTypeIconRadioGroup
                value={form.icon}
                onChange={(icon) =>
                  setForm((previous) => ({ ...previous, icon: icon as FormState["icon"] }))
                }
                icons={CUSTOM_TYPE_ICON_NAMES}
                getIcon={getItemTypeIcon}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <ItemTypeOptionRadioGroup
                label="Item type color"
                options={CUSTOM_TYPE_COLORS}
                value={form.color}
                onChange={(color) =>
                  setForm((previous) => ({ ...previous, color }))
                }
                getOptionLabel={(color) => getCustomTypeColorLabel(color)}
                className="flex flex-wrap gap-2"
                getOptionClassName={(selected) =>
                  cn(
                    "size-7 rounded-full border-2 border-transparent",
                    selected && "border-foreground",
                  )
                }
                renderOption={(color) => (
                  <span
                    className="block size-full rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
              />
            </div>

            <TypePreviewChip
              name={form.name.trim() || "Preview"}
              icon={form.icon}
              color={form.color}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || form.name.trim().length === 0}
            >
              {isSaving ? "Saving..." : editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setMoveToTypeId("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item type?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.totalItemCount > 0
                ? `This type has ${deleteTarget.totalItemCount} item${deleteTarget.totalItemCount === 1 ? "" : "s"}${
                    deleteTarget.totalItemCount > deleteTarget.itemCount
                      ? ` (${deleteTarget.totalItemCount - deleteTarget.itemCount} in trash)`
                      : ""
                  }. Move them to another type with the same kind.`
                : "This type has no items and will be removed permanently."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTarget && deleteTarget.totalItemCount > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="move-to-type">Move items to</Label>
              <Select
                value={moveToTypeId}
                onValueChange={(value) => setMoveToTypeId(value ?? "")}
              >
                <SelectTrigger id="move-to-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {moveTargets.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.isSystem
                        ? getItemTypeLabel(type.name, {
                            plural: true,
                            isSystem: type.isSystem,
                          })
                        : type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                isDeleting ||
                Boolean(
                  deleteTarget &&
                    deleteTarget.totalItemCount > 0 &&
                    moveToTypeId.length === 0,
                )
              }
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason="general"
      />
    </PageSection>
  );
}
