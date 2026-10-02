"use client";

import {
  CollectionMultiSelect,
  type SelectableCollection,
} from "@/components/collections/collection-multi-select";
import { GenerateSummaryButton } from "@/components/ai/generate-summary-button";
import { SuggestTagsButton } from "@/components/ai/suggest-tags-button";
import { SuggestedSummary } from "@/components/ai/suggested-summary";
import { SuggestedTags } from "@/components/ai/suggested-tags";
import {
  CODE_EDITOR_TYPE_NAMES,
  CodeEditor,
} from "@/components/code-editor/code-editor";
import { LanguageSelect } from "@/components/code-editor/language-select";
import {
  MARKDOWN_EDITOR_TYPE_NAMES,
  MarkdownEditor,
} from "@/components/markdown-editor/markdown-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getItemTypeBehaviour,
  type ItemTypeKind,
} from "@/lib/item-types/kinds";
import {
  CONTENT_TYPE_NAMES,
  LANGUAGE_TYPE_NAMES,
  URL_TYPE_NAMES,
} from "@/lib/item-form-constants";
import { cn } from "@/lib/utils";

export type ItemFormFieldsState = {
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  tags: string;
  collectionIds: string[];
};

type ItemFormFieldsProps = {
  idPrefix: string;
  typeName: string;
  typeKind?: ItemTypeKind;
  formState: ItemFormFieldsState;
  onChange: (patch: Partial<ItemFormFieldsState>) => void;
  collections: SelectableCollection[];
  isPro: boolean;
  disabled?: boolean;
  contentTextareaClassName?: string;
  suggestedTags: string[];
  isSuggesting: boolean;
  canSuggestTags: boolean;
  suggestedSummary: string | null;
  isSummarizing: boolean;
  canGenerateSummary: boolean;
  onSuggestTags: () => void;
  onAcceptSuggestedTag: (tag: string) => void;
  onRejectSuggestedTag: (tag: string) => void;
  onDismissSuggestedTags: () => void;
  onGenerateSummary: () => void;
  onAcceptSuggestedSummary: () => void;
  onRejectSuggestedSummary: () => void;
};

export function ItemFormFields({
  idPrefix,
  typeName,
  typeKind,
  formState,
  onChange,
  collections,
  isPro,
  disabled = false,
  contentTextareaClassName,
  suggestedTags,
  isSuggesting,
  canSuggestTags,
  suggestedSummary,
  isSummarizing,
  canGenerateSummary,
  onSuggestTags,
  onAcceptSuggestedTag,
  onRejectSuggestedTag,
  onDismissSuggestedTags,
  onGenerateSummary,
  onAcceptSuggestedSummary,
  onRejectSuggestedSummary,
}: ItemFormFieldsProps) {
  const behaviour = typeKind ? getItemTypeBehaviour(typeKind) : null;
  const normalizedName = typeName.toLowerCase();
  const showContent = behaviour
    ? behaviour.usesCodeEditor || behaviour.usesMarkdownEditor
    : CONTENT_TYPE_NAMES.has(normalizedName);
  const showLanguage = behaviour
    ? behaviour.usesLanguageField
    : LANGUAGE_TYPE_NAMES.has(normalizedName);
  const showUrl = behaviour
    ? behaviour.usesUrlField
    : URL_TYPE_NAMES.has(normalizedName);
  const useCodeEditor = behaviour
    ? behaviour.usesCodeEditor
    : CODE_EDITOR_TYPE_NAMES.has(normalizedName);
  const useMarkdownEditor = behaviour
    ? behaviour.usesMarkdownEditor
    : MARKDOWN_EDITOR_TYPE_NAMES.has(normalizedName);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={formState.title}
          onChange={(event) => onChange({ title: event.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-description`}>Description</Label>
          <GenerateSummaryButton
            isPro={isPro}
            disabled={!canGenerateSummary}
            onGenerate={onGenerateSummary}
            isLoading={isSummarizing}
          />
        </div>
        <Textarea
          id={`${idPrefix}-description`}
          value={formState.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={3}
        />
        <SuggestedSummary
          summary={suggestedSummary}
          onAccept={onAcceptSuggestedSummary}
          onReject={onRejectSuggestedSummary}
        />
      </div>

      {showLanguage ? (
        <LanguageSelect
          id={`${idPrefix}-language`}
          value={formState.language}
          onChange={(language) => onChange({ language })}
          disabled={disabled}
        />
      ) : null}

      {showContent ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-content`}>Content</Label>
          {useCodeEditor ? (
            <CodeEditor
              id={`${idPrefix}-content`}
              value={formState.content}
              language={formState.language}
              onChange={(content) => onChange({ content })}
            />
          ) : useMarkdownEditor ? (
            <MarkdownEditor
              id={`${idPrefix}-content`}
              value={formState.content}
              onChange={(content) => onChange({ content })}
            />
          ) : (
            <Textarea
              id={`${idPrefix}-content`}
              value={formState.content}
              onChange={(event) => onChange({ content: event.target.value })}
              className={cn("min-h-32 font-mono text-sm", contentTextareaClassName)}
            />
          )}
        </div>
      ) : null}

      {showUrl ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-url`}>URL</Label>
          <Input
            id={`${idPrefix}-url`}
            type="url"
            value={formState.url}
            onChange={(event) => onChange({ url: event.target.value })}
            required
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${idPrefix}-tags`}
            value={formState.tags}
            onChange={(event) => onChange({ tags: event.target.value })}
            placeholder="Comma-separated tags"
            className="min-w-0 flex-1"
          />
          <SuggestTagsButton
            isPro={isPro}
            disabled={!canSuggestTags}
            onSuggest={onSuggestTags}
            isLoading={isSuggesting}
          />
        </div>
        <SuggestedTags
          tags={suggestedTags}
          onAccept={onAcceptSuggestedTag}
          onReject={onRejectSuggestedTag}
          onDismiss={onDismissSuggestedTags}
        />
      </div>

      <CollectionMultiSelect
        id={`${idPrefix}-collections`}
        collections={collections}
        value={formState.collectionIds}
        onChange={(collectionIds) => onChange({ collectionIds })}
        disabled={disabled}
      />
    </>
  );
}
