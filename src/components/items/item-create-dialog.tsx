"use client";

import { createElement, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import {
  type SelectableCollection,
} from "@/components/collections/collection-multi-select";
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
import { getItemTypeIcon, getItemTypeLabel } from "@/lib/item-type-styles";
import { FILE_TYPE_NAMES } from "@/lib/item-form-constants";
import { isAtItemLimit } from "@/lib/subscription-limits";
import {
  resolveDefaultCreateType,
  type CreatableItemType,
} from "@/lib/validations/items";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { useAiItemSuggestions } from "@/hooks/use-ai-item-suggestions";
import { consumeItemCreatePrefill } from "@/components/items/item-create-prefill";
import { cn } from "@/lib/utils";

const CREATABLE_ITEM_TYPES: {
  type: CreatableItemType;
  icon: string;
}[] = [
  { type: "snippet", icon: "Code" },
  { type: "prompt", icon: "Sparkles" },
  { type: "command", icon: "Terminal" },
  { type: "note", icon: "StickyNote" },
  { type: "link", icon: "Link" },
  { type: "image", icon: "Image" },
  { type: "file", icon: "File" },
];

type CreateFormState = {
  type: CreatableItemType;
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  tags: string;
  collectionIds: string[];
  uploadedFile: UploadedFile | null;
};

const initialFormState: CreateFormState = {
  type: "snippet",
  title: "",
  description: "",
  content: "",
  url: "",
  language: "",
  tags: "",
  collectionIds: [],
  uploadedFile: null,
};

type ItemCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPro: boolean;
  itemCount: number;
  defaultType?: CreatableItemType;
  collections: SelectableCollection[];
};

export function ItemCreateDialog({
  open,
  onOpenChange,
  isPro,
  itemCount,
  defaultType,
  collections,
}: ItemCreateDialogProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<CreateFormState>(initialFormState);
  const [isCreating, startCreating] = useTransition();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const showFileUpload = FILE_TYPE_NAMES.has(formState.type);
  const canCreate =
    formState.title.trim().length > 0 &&
    (!FILE_TYPE_NAMES.has(formState.type) || formState.uploadedFile !== null) &&
    (formState.type !== "link" || formState.url.trim().length > 0) &&
    !isCreating;

  const suggestContent =
    formState.type === "link"
      ? formState.content.trim() || formState.url.trim()
      : formState.content.trim();
  const summaryContentInput = {
    type: formState.type,
    content: formState.content,
    url: formState.url,
    fileName: formState.uploadedFile?.fileName,
    language: formState.language,
  };

  const aiSuggestions = useAiItemSuggestions({
    title: formState.title,
    tags: formState.tags,
    type: formState.type,
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
      setFormState({
        ...initialFormState,
        type: resolveDefaultCreateType(prefill?.type ?? defaultType, isPro),
        title: prefill?.title ?? "",
        description: prefill?.description ?? "",
        content: prefill?.content ?? "",
        url: prefill?.url ?? "",
        language: prefill?.language ?? "",
        tags: prefill?.tags ?? "",
      });
      resetSuggestions();
    }
  }, [open, defaultType, isPro, resetSuggestions]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFormState(initialFormState);
      aiSuggestions.resetSuggestions();
    }

    onOpenChange(nextOpen);
  }

  function handleFormChange(patch: Partial<CreateFormState>) {
    setFormState((previous) => ({ ...previous, ...patch }));
  }

  function handleTypeChange(type: CreatableItemType) {
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
      setFormState(initialFormState);
      onOpenChange(false);
      router.refresh();
    });
  }

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
              value={formState.type}
              onValueChange={(value) =>
                handleTypeChange(value as CreatableItemType)
              }
            >
              <SelectTrigger id="item-create-type" className="w-fit min-w-40">
                <SelectValue>{getItemTypeLabel(formState.type)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CREATABLE_ITEM_TYPES.map(({ type, icon }) => (
                  <SelectItem
                    key={type}
                    value={type}
                    disabled={FILE_TYPE_NAMES.has(type) && !isPro}
                  >
                    {createElement(getItemTypeIcon(icon), {
                      className: "size-4 shrink-0",
                    })}
                    {getItemTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showFileUpload ? (
            <div className="space-y-2">
              <Label>{formState.type === "image" ? "Image" : "File"}</Label>
              <FileUpload
                category={formState.type === "image" ? "image" : "file"}
                value={formState.uploadedFile}
                onChange={(uploadedFile) => handleFormChange({ uploadedFile })}
                disabled={isCreating}
              />
            </div>
          ) : null}

          <ItemFormFields
            idPrefix="item-create"
            typeName={formState.type}
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
    </>
  );
}
