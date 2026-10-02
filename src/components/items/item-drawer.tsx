"use client";

import { createElement, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  FileIcon,
  Info,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteItem, restoreItem, updateItem } from "@/actions/items";
import { explainCode, optimizePrompt } from "@/actions/ai";
import {
  type SelectableCollection,
} from "@/components/collections/collection-multi-select";
import { ItemFavoriteButton } from "@/components/items/item-favorite-button";
import { ItemShareDialog } from "@/components/items/item-share-dialog";
import { ItemFormFields } from "@/components/items/item-form-fields";
import { ItemPinButton } from "@/components/items/item-pin-button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { useAiItemSuggestions } from "@/hooks/use-ai-item-suggestions";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useResizableDrawerWidth } from "@/hooks/use-resizable-drawer-width";
import { formatLongDate } from "@/lib/format-date";
import { FILE_TYPE_NAMES } from "@/lib/item-form-constants";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CodeEditor,
  type CodeEditorView,
} from "@/components/code-editor/code-editor";
import {
  MarkdownEditor,
  type MarkdownEditorView,
} from "@/components/markdown-editor/markdown-editor";
import type { ItemDetail } from "@/lib/db/items";
import { getItemCopyText } from "@/lib/item-copy";
import {
  getItemTypeBehaviour,
  getSystemKindForName,
  normalizeItemTypeKind,
  type ItemTypeKind,
} from "@/lib/item-types/kinds";
import { formatFileSize } from "@/lib/file-upload";
import { getItemTypeIcon, getItemTypeStyles } from "@/lib/item-type-styles";
import {
  toAiItemTypeName,
} from "@/lib/item-types/normalize-create-type";
import { isShareableItemTypeKind } from "@/lib/share-links/constants";
import { cn } from "@/lib/utils";

import { useItemDrawer } from "./item-drawer-context";

type ItemDetailResponse = Omit<ItemDetail, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type EditFormState = {
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  tags: string;
  collectionIds: string[];
};

const DOWNLOADABLE_TYPE_NAMES = FILE_TYPE_NAMES;

function isDownloadableItem(item: ItemDetailResponse) {
  return (
    Boolean(item.fileName) &&
    DOWNLOADABLE_TYPE_NAMES.has(item.type.name.toLowerCase())
  );
}

function ItemDownloadLink({
  item,
  className,
}: {
  item: ItemDetailResponse;
  className?: string;
}) {
  if (!isDownloadableItem(item)) {
    return null;
  }

  return (
    <a
      href={`/api/items/${item.id}/download?download=1`}
      download={item.fileName ?? undefined}
      className={buttonVariants({
        variant: "outline",
        size: "sm",
        className: cn("shrink-0", className),
      })}
    >
      <Download />
      Download
    </a>
  );
}

function toFormState(item: ItemDetailResponse): EditFormState {
  return {
    title: item.title,
    description: item.description ?? "",
    content: item.content ?? "",
    url: item.url ?? "",
    language: item.language ?? "",
    tags: item.tags.join(", "),
    collectionIds: item.collections.map((collection) => collection.id),
  };
}

function ItemDrawerSkeleton() {
  return (
    <div className="space-y-6 px-1">
      <div className="space-y-3">
        <div className="h-6 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function ItemDrawerContent({
  item,
  isPro,
  onEdit,
  onDelete,
  onFavoriteToggle,
  onPinToggle,
  onItemUpdate,
}: {
  item: ItemDetailResponse;
  isPro: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFavoriteToggle: (isFavorite: boolean) => void;
  onPinToggle: (isPinned: boolean) => void;
  onItemUpdate: (item: ItemDetailResponse) => void;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [codeView, setCodeView] = useState<CodeEditorView>("code");
  const [isExplaining, startExplain] = useTransition();
  const [optimizedPrompt, setOptimizedPrompt] = useState<string | null>(null);
  const [promptView, setPromptView] = useState<MarkdownEditorView>("original");
  const [isOptimizing, startOptimize] = useTransition();
  const [isAcceptingOptimized, startAcceptOptimized] = useTransition();
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const { copy } = useCopyToClipboard();
  const typeName = item.type.name.toLowerCase();
  const resolvedKind: ItemTypeKind = item.type.kind
    ? normalizeItemTypeKind(item.type.kind)
    : getSystemKindForName(typeName);
  const typeBehaviour = getItemTypeBehaviour(resolvedKind);
  const showExplainableCodeEditor = typeBehaviour.usesCodeEditor;
  const showOptimizablePrompt = typeName === "prompt";
  const showShare = isShareableItemTypeKind(resolvedKind);
  const aiItemType = toAiItemTypeName({
    name: item.type.name,
    slug: item.type.slug ?? item.type.name,
    kind: resolvedKind,
    isSystem: item.type.isSystem ?? true,
  });

  async function handleCopy() {
    await copy(getItemCopyText(item));
  }

  function handleExplain() {
    if (!item.content?.trim()) {
      return;
    }

    startExplain(async () => {
      const result = await explainCode({
        title: item.title,
        content: item.content ?? "",
        language: item.language ?? undefined,
        type: aiItemType as "snippet" | "command",
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setExplanation(result.data.explanation);
      setCodeView("explain");
    });
  }

  function handleOptimize() {
    if (!item.content?.trim()) {
      return;
    }

    startOptimize(async () => {
      const result = await optimizePrompt({
        title: item.title,
        content: item.content ?? "",
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (!result.data.improved) {
        toast.success("This prompt already looks well-structured");
        return;
      }

      setOptimizedPrompt(result.data.prompt);
      setPromptView("optimized");
    });
  }

  function handleRejectOptimized() {
    setOptimizedPrompt(null);
    setPromptView("original");
  }

  function handleAcceptOptimized() {
    if (!optimizedPrompt) {
      return;
    }

    startAcceptOptimized(async () => {
      const result = await updateItem(item.id, {
        title: item.title,
        description: item.description ?? "",
        content: optimizedPrompt,
        tags: item.tags,
        collectionIds: item.collections.map((collection) => collection.id),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onItemUpdate({
        ...result.data,
        createdAt: result.data.createdAt.toISOString(),
        updatedAt: result.data.updatedAt.toISOString(),
      });
      setOptimizedPrompt(null);
      setPromptView("original");
      toast.success("Prompt updated");
    });
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border py-2">
        <ItemFavoriteButton
          itemId={item.id}
          isFavorite={item.isFavorite}
          variant="button"
          onToggle={onFavoriteToggle}
        />
        <ItemPinButton
          itemId={item.id}
          isPinned={item.isPinned}
          variant="button"
          onToggle={onPinToggle}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={handleCopy}
        >
          <Copy />
          Copy
        </Button>
        <ItemDownloadLink item={item} />
        {showShare ? (
          <ItemShareDialog itemId={item.id} itemTitle={item.title} />
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label="Delete"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-4">
        <div className="space-y-6 py-6">
          {item.description ? (
            <section className="space-y-2">
              <h3 className="text-sm text-muted-foreground">Description</h3>
              <p className="text-sm">{item.description}</p>
            </section>
          ) : null}

          {item.content ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Content</h3>
              {showExplainableCodeEditor ? (
                <CodeEditor
                  value={item.content}
                  language={item.language ?? undefined}
                  readOnly
                  enableExplain
                  isPro={isPro}
                  explanation={explanation}
                  activeView={codeView}
                  onViewChange={setCodeView}
                  onExplain={handleExplain}
                  onUpgrade={() => setIsUpgradeOpen(true)}
                  isExplaining={isExplaining}
                />
              ) : typeBehaviour.usesMarkdownEditor ? (
                <MarkdownEditor
                  value={item.content}
                  readOnly
                  enableOptimize={showOptimizablePrompt}
                  isPro={isPro}
                  optimizedValue={optimizedPrompt}
                  activeView={promptView}
                  onViewChange={setPromptView}
                  onOptimize={handleOptimize}
                  onUpgrade={() => setIsUpgradeOpen(true)}
                  isOptimizing={isOptimizing}
                  onAcceptOptimized={handleAcceptOptimized}
                  onRejectOptimized={handleRejectOptimized}
                  isAcceptingOptimized={isAcceptingOptimized}
                />
              ) : (
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {item.content}
                </pre>
              )}
            </section>
          ) : null}

          {item.url ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">URL</h3>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {item.url}
              </a>
            </section>
          ) : null}

          {item.fileName && resolvedKind === "image" ? (
            <section className="space-y-2">
              <h3 className="text-sm text-muted-foreground">Image</h3>
              <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/items/${item.id}/download`}
                  alt={item.fileName}
                  className="max-h-80 w-full object-contain"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {item.fileName}
                {item.fileSize ? ` · ${formatFileSize(item.fileSize)}` : ""}
              </p>
            </section>
          ) : null}

          {item.fileName && resolvedKind === "file" ? (
            <section className="space-y-2">
              <h3 className="text-sm text-muted-foreground">File</h3>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileIcon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.fileName}</p>
                  {item.fileSize ? (
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(item.fileSize)}
                    </p>
                  ) : null}
                </div>
                <ItemDownloadLink item={item} />
              </div>
            </section>
          ) : null}

          {item.tags.length > 0 ? (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Tag className="size-3.5" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {item.collections.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Collections</h3>
              <div className="flex flex-wrap gap-1.5">
                {item.collections.map((collection) => (
                  <span
                    key={collection.id}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {collection.name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Info className="size-3.5" />
              Details
            </h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatLongDate(item.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{formatLongDate(item.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </ScrollArea>
      </div>

      <UpgradePrompt
        open={isUpgradeOpen}
        onOpenChange={setIsUpgradeOpen}
        reason="general"
      />
    </>
  );
}

function ItemDrawerEditor({
  item,
  formState,
  collections,
  isPro,
  aiSuggestions,
  onChange,
  onCancel,
  onSave,
  isSaving,
}: {
  item: ItemDetailResponse;
  formState: EditFormState;
  collections: SelectableCollection[];
  isPro: boolean;
  aiSuggestions: ReturnType<typeof useAiItemSuggestions>;
  onChange: (patch: Partial<EditFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const typeName = item.type.name.toLowerCase();
  const typeKind: ItemTypeKind = item.type.kind
    ? normalizeItemTypeKind(item.type.kind)
    : getSystemKindForName(typeName);
  const canSave = formState.title.trim().length > 0 && !isSaving;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-border py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={!canSave}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-4">
        <div className="space-y-6 py-6">
          <ItemFormFields
            idPrefix="item-edit"
            typeName={typeName}
            typeKind={typeKind}
            formState={formState}
            onChange={onChange}
            collections={collections}
            isPro={isPro}
            disabled={isSaving}
            contentTextareaClassName="min-h-40"
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

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Type</h3>
            <Badge variant="secondary">{item.type.name}</Badge>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Details</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatLongDate(item.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{formatLongDate(item.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ItemDrawerPanel({
  itemId,
  collections,
  isPro,
}: {
  itemId: string;
  collections: SelectableCollection[];
  isPro: boolean;
}) {
  const router = useRouter();
  const { closeItem } = useItemDrawer();
  const [item, setItem] = useState<ItemDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [formState, setFormState] = useState<EditFormState | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const editTypeName = item?.type.name.toLowerCase() ?? "";
  const editKind: ItemTypeKind = item?.type.kind
    ? normalizeItemTypeKind(item.type.kind)
    : getSystemKindForName(editTypeName);
  const editAiType =
    item &&
    toAiItemTypeName({
      name: item.type.name,
      slug: item.type.slug ?? item.type.name,
      kind: editKind,
      isSystem: item.type.isSystem ?? true,
    });
  const activeFormState = formState ?? {
    title: "",
    description: "",
    content: "",
    url: "",
    language: "",
    tags: "",
    collectionIds: [],
  };

  function getSuggestContent(state: EditFormState, kind: ItemTypeKind): string {
    if (kind === "link") {
      return state.content.trim() || state.url.trim();
    }

    return state.content.trim();
  }

  function getSummaryContentInput(
    state: EditFormState,
    typeName: string,
    fileName?: string | null,
  ) {
    return {
      type: typeName,
      content: state.content,
      url: state.url,
      fileName,
      language: state.language,
    };
  }

  const suggestContent =
    formState && item ? getSuggestContent(formState, editKind) : "";
  const summaryContentInput =
    formState && item && editAiType
      ? getSummaryContentInput(formState, editAiType, item.fileName)
      : { type: editAiType ?? "snippet" };

  const aiSuggestions = useAiItemSuggestions({
    title: activeFormState.title,
    tags: activeFormState.tags,
    type: editAiType ?? "snippet",
    suggestContent,
    summaryContentInput,
    onTagsChange: (tags) => handleFormChange({ tags }),
    onDescriptionChange: (description) => handleFormChange({ description }),
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchItem() {
      try {
        const response = await fetch(`/api/items/${itemId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            response.status === 404 ? "Item not found" : "Failed to load item",
          );
        }

        const data = (await response.json()) as ItemDetailResponse;
        setItem(data);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load item",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchItem();

    return () => {
      controller.abort();
    };
  }, [itemId]);

  function handleEdit() {
    if (!item) {
      return;
    }

    aiSuggestions.resetSuggestions();
    setFormState(toFormState(item));
    setMode("edit");
  }

  function handleCancel() {
    aiSuggestions.resetSuggestions();
    setFormState(null);
    setMode("view");
  }

  function handleFormChange(patch: Partial<EditFormState>) {
    setFormState((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  function handleDeleteConfirm() {
    if (!item) {
      return;
    }

    startDeleting(async () => {
      const result = await deleteItem(item.id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setIsDeleteOpen(false);
      const deletedItemId = item.id;
      closeItem();
      router.refresh();
      toast.success("Moved to trash", {
        action: {
          label: "Undo",
          onClick: () => {
            void restoreItem(deletedItemId)
              .then((restoreResult) => {
                if (!restoreResult.success) {
                  toast.error(restoreResult.error);
                  return;
                }

                toast.success("Item restored");
                router.refresh();
              })
              .catch(() => toast.error("Failed to restore item"));
          },
        },
      });
    });
  }

  function handleSave() {
    if (!item || !formState) {
      return;
    }

    const title = formState.title.trim();

    if (!title) {
      return;
    }

    startSaving(async () => {
      const result = await updateItem(item.id, {
        title,
        description: formState.description,
        content: formState.content,
        url: formState.url,
        language: formState.language,
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

      setItem({
        ...result.data,
        createdAt: result.data.createdAt.toISOString(),
        updatedAt: result.data.updatedAt.toISOString(),
      });
      setFormState(null);
      setMode("view");
      toast.success("Item updated");
      router.refresh();
    });
  }

  function handleFavoriteToggle(isFavorite: boolean) {
    setItem((current) => (current ? { ...current, isFavorite } : current));
  }

  function handlePinToggle(isPinned: boolean) {
    setItem((current) => (current ? { ...current, isPinned } : current));
  }

  const typeStyles = item ? getItemTypeStyles(item.type.color) : null;

  return (
    <>
      <SheetHeader className="border-b border-border px-6 py-5">
        <div className="flex items-start gap-3 pr-8">
          {item && typeStyles ? (
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                typeStyles.textClassName,
                typeStyles.bgClassName,
                !item.type.color && "bg-muted text-muted-foreground",
              )}
              style={{ ...typeStyles.textStyle, ...typeStyles.bgStyle }}
            >
              {createElement(getItemTypeIcon(item.type.icon), {
                className: "size-4",
              })}
            </div>
          ) : (
            <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <SheetTitle className="truncate text-xl">
              {item?.title ?? (isLoading ? "Loading item..." : "Item")}
            </SheetTitle>
            {item ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.type.name}</Badge>
                {item.language ? (
                  <Badge variant="outline">{item.language}</Badge>
                ) : null}
              </div>
            ) : (
              <SheetDescription className="sr-only">
                Item details drawer
              </SheetDescription>
            )}
          </div>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
        {isLoading ? <ItemDrawerSkeleton /> : null}
        {!isLoading && error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : null}
        {!isLoading && item && mode === "view" ? (
          <ItemDrawerContent
            item={item}
            isPro={isPro}
            onEdit={handleEdit}
            onDelete={() => setIsDeleteOpen(true)}
            onFavoriteToggle={handleFavoriteToggle}
            onPinToggle={handlePinToggle}
            onItemUpdate={(updatedItem) => {
              setItem(updatedItem);
              router.refresh();
            }}
          />
        ) : null}
        {!isLoading && item && mode === "edit" && formState ? (
          <ItemDrawerEditor
            item={item}
            formState={formState}
            collections={collections}
            isPro={isPro}
            aiSuggestions={aiSuggestions}
            onChange={handleFormChange}
            onCancel={handleCancel}
            onSave={handleSave}
            isSaving={isSaving}
          />
        ) : null}
      </div>

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Move to trash?"
        description={
          <>
            &ldquo;{item?.title}&rdquo; will be moved to trash. You can restore
            it from the Trash page for up to 30 days.
          </>
        }
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

export function ItemDrawer({
  collections,
  isPro,
}: {
  collections: SelectableCollection[];
  isPro: boolean;
}) {
  const { selectedItemId, closeItem } = useItemDrawer();
  const { width, isMobile, isResizing, startResize, minWidth } =
    useResizableDrawerWidth();

  return (
    <Sheet
      open={selectedItemId !== null}
      onOpenChange={(open) => {
        if (!open) {
          closeItem();
        }
      }}
    >
      <SheetContent
        side="right"
        className={cn(
          "flex h-svh max-w-none flex-col gap-0 p-0",
          "data-[side=right]:inset-0 data-[side=right]:w-full data-[side=right]:max-w-full",
          "md:data-[side=right]:inset-y-0 md:data-[side=right]:right-0 md:data-[side=right]:left-auto md:data-[side=right]:w-auto md:data-[side=right]:max-w-[92vw]",
          isResizing && "md:transition-none",
        )}
        style={
          isMobile
            ? undefined
            : {
                width,
                minWidth,
              }
        }
      >
        {!isMobile ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize drawer"
            aria-valuemin={minWidth}
            aria-valuenow={width}
            className="absolute inset-y-0 left-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none md:block before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border hover:before:bg-primary/40 active:before:bg-primary/60"
            onPointerDown={startResize}
          />
        ) : null}
        {selectedItemId ? (
          <ItemDrawerPanel
            key={selectedItemId}
            itemId={selectedItemId}
            collections={collections}
            isPro={isPro}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
