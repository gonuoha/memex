export type TextPart = {
  text: string;
  highlight: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches against the original string so case-folding that changes length cannot misalign offsets. */
export function splitHighlightParts(
  value: string,
  terms: string[],
): TextPart[] {
  const patterns = [...new Set(terms.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  if (!value || patterns.length === 0) {
    return [{ text: value, highlight: false }];
  }

  const matcher = new RegExp(patterns.join("|"), "giu");
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(matcher)) {
    if (match.index > cursor) {
      parts.push({ text: value.slice(cursor, match.index), highlight: false });
    }

    parts.push({ text: match[0], highlight: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), highlight: false });
  }

  return parts.length > 0 ? parts : [{ text: value, highlight: false }];
}
