"use client";

import { createElement, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import {
  type SelectableCollection,
} from "@/components/collections/collection-multi-select";
import { useItemTypes } from "@/components/items/item-types-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileUpload,
  type UploadedFile,
} from "@/components/items/file-upload";
import { ItemFormFields } from "@/components/items/item-form-fields";
import {
  getItemTypeIcon,
  getItemTypeLabel,
  SYSTEM_ITEM_TYPE_ORDER,
} from "@/lib/item-type-styles";
import { getTypeSlug } from "@/lib/item-type-slugs";
import { getSystemKindForName } from "@/lib/item-types/kinds";
import {
  isLinkKind,
  resolveDefaultCreateTypeSlug,
  toAiItemTypeName,
} from "@/lib/item-types/normalize-create-type";
import type { ResolvedItemType } from "@/lib/item-types/types";
import { getItemTypeBehaviour } from "@/lib/item-types/kinds";
import { isAtItemLimit } from "@/lib/subscription-limits";
import type { CreateItemTypeSlug, CreatableItemType } from "@/lib/validations/items";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { useAiItemSuggestions } from "@/hooks/use-ai-item-suggestions";
import { consumeItemCreatePrefill } from "@/components/items/item-create-prefill";
import { cn } from "@/lib/utils";

type CreateFormState = {
  type: CreateItemTypeSlug;
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  tags: string;
  collectionIds: string[];
  uploadedFile: UploadedFile | null;
};

function buildInitialFormState(
  typeSlug: string,
  prefill?: ReturnType<typeof consumeItemCreatePrefill>,
): CreateFormState {
  return {
    type: typeSlug,
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    content: prefill?.content ?? "",
    url: prefill?.url ?? "",
    language: prefill?.language ?? "",
    tags: prefill?.tags ?? "",
    collectionIds: [],
    uploadedFile: null,
  };
}

type ItemCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPro: boolean;
  itemCount: number;
  defaultType?: CreateItemTypeSlug | CreatableItemType;
  collections: SelectableCollection[];
  itemTypes?: ResolvedItemType[];
};

export function ItemCreateDialog({
  open,
  onOpenChange,
  isPro,
  itemCount,
  defaultType,
  collections,
  itemTypes: itemTypesProp,
}: ItemCreateDialogProps) {
  const router = useRouter();
  const itemTypesFromContext = useItemTypes();
  const itemTypes =
    itemTypesProp && itemTypesProp.length > 0
      ? itemTypesProp
      : itemTypesFromContext;

  const creatableTypes: ResolvedItemType[] = useMemo(
    () =>
      itemTypes.length > 0
        ? itemTypes
        : SYSTEM_ITEM_TYPE_ORDER.map((name) => ({
            id: name,
            name,
            slug: getTypeSlug(name),
            label: getItemTypeLabel(name, { plural: true, isSystem: true }),
            icon: null,
            color: null,
            kind: getSystemKindForName(name),
            isSystem: true,
          })),
    [itemTypes],
  );

  const defaultTypeSlug = resolveDefaultCreateTypeSlug(
    defaultType,
    creatableTypes,
    isPro,
  );

  const [formState, setFormState] = useState<CreateFormState>(() =>
    buildInitialFormState(defaultTypeSlug),
  );
  const [isCreating, startCreating] = useTransition();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [customTypeUpgradeOpen, setCustomTypeUpgradeOpen] = useState(false);

  const selectedType =
    creatableTypes.find((type) => type.slug === formState.type) ??
    creatableTypes[0];
  const selectedBehaviour = selectedType
    ? getItemTypeBehaviour(selectedType.kind)
    : null;

  const showFileUpload = selectedBehaviour?.usesFileUpload ?? false;
  const requiresLinkUrl = selectedBehaviour?.usesUrlField ?? isLinkKind(selectedType);
  const canCreate =
    formState.title.trim().length > 0 &&
    (!showFileUpload || formState.uploadedFile !== null) &&
    (!requiresLinkUrl || formState.url.trim().length > 0) &&
    !isCreating;

  const aiTypeName = selectedType ? toAiItemTypeName(selectedType) : "snippet";

  const suggestContent = isLinkKind(selectedType)
    ? formState.content.trim() || formState.url.trim()
    : formState.content.trim();
  const summaryContentInput = {
    type: aiTypeName,
    content: formState.content,
    url: formState.url,
    fileName: formState.uploadedFile?.fileName,
    language: formState.language,
  };

  const aiSuggestions = useAiItemSuggestions({
    title: formState.title,
    tags: formState.tags,
    type: aiTypeName,
    suggestContent,
    summaryContentInput,
    onTagsChange: (tags) => handleFormChange({ tags }),
    onDescriptionChange: (description) => handleFormChange({ description }),
  });
  const wasOpenRef = useRef(open);
  const { resetSuggestions } = aiSuggestions;

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (justOpened) {
      const prefill = consumeItemCreatePrefill();
      const prefillType = prefill?.type ?? defaultType;
      const resolvedSlug = resolveDefaultCreateTypeSlug(
        prefillType,
        creatableTypes,
        isPro,
      );
      setFormState(buildInitialFormState(resolvedSlug, prefill ?? undefined));
      resetSuggestions();
    }
  }, [open, defaultType, isPro, resetSuggestions, creatableTypes]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFormState(buildInitialFormState(defaultTypeSlug));
      aiSuggestions.resetSuggestions();
    }

    onOpenChange(nextOpen);
  }

  function handleFormChange(patch: Partial<CreateFormState>) {
    setFormState((previous) => ({ ...previous, ...patch }));
  }

  function handleTypeChange(type: CreateItemTypeSlug) {
    const nextType = creatableTypes.find((entry) => entry.slug === type);

    if (nextType && !nextType.isSystem && !isPro) {
      setCustomTypeUpgradeOpen(true);
      return;
    }

    if (
      nextType &&
      (nextType.kind === "file" || nextType.kind === "image") &&
      !isPro
    ) {
      setUpgradeOpen(true);
      return;
    }

    setFormState((previous) => ({
      ...previous,
      type,
      uploadedFile: null,
    }));
    aiSuggestions.resetSuggestions();
  }

  function handleCreate() {
    const title = formState.title.trim();

    if (!title) {
      return;
    }

    if (isAtItemLimit(itemCount, isPro)) {
      setUpgradeOpen(true);
      return;
    }

    startCreating(async () => {
      const result = await createItem({
        type: formState.type,
        title,
        description: formState.description,
        content: formState.content,
        url: formState.url,
        language: formState.language,
        fileUrl: formState.uploadedFile?.fileUrl,
        fileName: formState.uploadedFile?.fileName,
        fileSize: formState.uploadedFile?.fileSize,
        tags: formState.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        collectionIds: formState.collectionIds,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Item created");
      setFormState(buildInitialFormState(defaultTypeSlug));
      onOpenChange(false);
      router.refresh();
    });
  }

  const selectValue =
    creatableTypes.some((type) => type.slug === formState.type)
      ? formState.type
      : (selectedType?.slug ?? defaultTypeSlug);

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:gap-4 sm:overflow-y-auto sm:rounded-xl sm:p-4",
        )}
      >
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-0 sm:pt-0">
          <DialogTitle>New Item</DialogTitle>
          <DialogDescription>
            Choose a type and fill in the details for your new item.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 sm:px-0">
          <div className="space-y-2">
            <Label htmlFor="item-create-type">Type</Label>
            <Select
              value={selectValue}
              onValueChange={(value) =>
                handleTypeChange(value as CreateItemTypeSlug)
              }
            >
              <SelectTrigger id="item-create-type" className="w-fit min-w-40">
                <SelectValue>
                  {selectedType?.isSystem
                    ? getItemTypeLabel(selectedType.name, { isSystem: true })
                    : selectedType?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {creatableTypes.map((type) => (
                  <SelectItem
                    key={type.id}
                    value={type.slug}
                    disabled={
                      ((type.kind === "file" || type.kind === "image") &&
                        !isPro) ||
                      (!type.isSystem && !isPro)
                    }
                  >
                    {createElement(getItemTypeIcon(type.icon), {
                      className: "size-4 shrink-0",
                    })}
                    {type.isSystem
                      ? getItemTypeLabel(type.name, { isSystem: true })
                      : type.name}
                    {!type.isSystem && !isPro ? " (Pro)" : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showFileUpload ? (
            <div className="space-y-2">
              <Label>{selectedType?.kind === "image" ? "Image" : "File"}</Label>
              <FileUpload
                category={selectedType?.kind === "image" ? "image" : "file"}
                value={formState.uploadedFile}
                onChange={(uploadedFile) => handleFormChange({ uploadedFile })}
                disabled={isCreating}
              />
            </div>
          ) : null}

          <ItemFormFields
            idPrefix="item-create"
            typeName={selectedType?.name ?? formState.type}
            typeKind={selectedType?.kind}
            formState={formState}
            onChange={handleFormChange}
            collections={collections}
            isPro={isPro}
            disabled={isCreating}
            suggestedTags={aiSuggestions.suggestedTags}
            isSuggesting={aiSuggestions.isSuggesting}
            canSuggestTags={aiSuggestions.canSuggestTags}
            suggestedSummary={aiSuggestions.suggestedSummary}
            isSummarizing={aiSuggestions.isSummarizing}
            canGenerateSummary={aiSuggestions.canGenerateSummaryEnabled}
            onSuggestTags={aiSuggestions.handleSuggestTags}
            onAcceptSuggestedTag={aiSuggestions.handleAcceptSuggestedTag}
            onRejectSuggestedTag={aiSuggestions.handleRejectSuggestedTag}
            onDismissSuggestedTags={aiSuggestions.dismissSuggestedTags}
            onGenerateSummary={aiSuggestions.handleGenerateSummary}
            onAcceptSuggestedSummary={aiSuggestions.handleAcceptSuggestedSummary}
            onRejectSuggestedSummary={aiSuggestions.handleRejectSuggestedSummary}
          />
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none sm:-mx-4 sm:-mb-4 sm:rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <UpgradePrompt
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      reason="item_limit"
    />
    <UpgradePrompt
      open={customTypeUpgradeOpen}
      onOpenChange={setCustomTypeUpgradeOpen}
      reason="general"
    />
    </>
  );
}
