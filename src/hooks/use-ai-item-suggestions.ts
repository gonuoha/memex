"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateAutoTags, generateSummary } from "@/actions/ai";
import {
  buildSummaryContent,
  canGenerateSummary,
} from "@/lib/ai/build-summary-content";
import { appendTagToTagsString, parseTagsString } from "@/lib/parse-tags";

type SummaryContentInput = {
  type: string;
  content?: string;
  url?: string;
  fileName?: string | null;
  language?: string;
};

type UseAiItemSuggestionsOptions = {
  title: string;
  tags: string;
  type: string;
  suggestContent: string;
  summaryContentInput: SummaryContentInput;
  onTagsChange: (tags: string) => void;
  onDescriptionChange: (description: string) => void;
};

export function useAiItemSuggestions({
  title,
  tags,
  type,
  suggestContent,
  summaryContentInput,
  onTagsChange,
  onDescriptionChange,
}: UseAiItemSuggestionsOptions) {
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestedSummary, setSuggestedSummary] = useState<string | null>(null);
  const [isSuggesting, startSuggesting] = useTransition();
  const [isSummarizing, startSummarizing] = useTransition();

  const canSuggestTags =
    title.trim().length > 0 && suggestContent.length > 0;
  const canGenerateSummaryEnabled = canGenerateSummary(
    title,
    summaryContentInput,
  );

  const resetSuggestions = useCallback(() => {
    setSuggestedTags([]);
    setSuggestedSummary(null);
  }, []);

  function handleGenerateSummary() {
    startSummarizing(async () => {
      const result = await generateSummary({
        title: title.trim(),
        content: buildSummaryContent(summaryContentInput),
        type: type as "snippet" | "prompt" | "command" | "note" | "link",
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setSuggestedSummary(result.data.summary);
    });
  }

  function handleAcceptSuggestedSummary() {
    if (!suggestedSummary) {
      return;
    }

    onDescriptionChange(suggestedSummary);
    setSuggestedSummary(null);
  }

  function handleRejectSuggestedSummary() {
    setSuggestedSummary(null);
  }

  function handleSuggestTags() {
    startSuggesting(async () => {
      const result = await generateAutoTags({
        title: title.trim(),
        content: suggestContent,
        type: type as "snippet" | "prompt" | "command" | "note" | "link",
        existingTags: parseTagsString(tags),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setSuggestedTags(result.data.tags);
    });
  }

  function handleAcceptSuggestedTag(tag: string) {
    onTagsChange(appendTagToTagsString(tags, tag));
    setSuggestedTags((previous) => previous.filter((value) => value !== tag));
  }

  function handleRejectSuggestedTag(tag: string) {
    setSuggestedTags((previous) => previous.filter((value) => value !== tag));
  }

  return {
    suggestedTags,
    suggestedSummary,
    isSuggesting,
    isSummarizing,
    canSuggestTags,
    canGenerateSummaryEnabled,
    resetSuggestions,
    handleGenerateSummary,
    handleAcceptSuggestedSummary,
    handleRejectSuggestedSummary,
    handleSuggestTags,
    handleAcceptSuggestedTag,
    handleRejectSuggestedTag,
    dismissSuggestedTags: () => setSuggestedTags([]),
  };
}
