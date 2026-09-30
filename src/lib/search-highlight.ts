export type TextPart = {
  text: string;
  highlight: boolean;
};

export function splitHighlightParts(
  value: string,
  terms: string[],
): TextPart[] {
  if (!value || terms.length === 0) {
    return [{ text: value, highlight: false }];
  }

  const normalizedTerms = terms
    .map((term) => term.toLowerCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (normalizedTerms.length === 0) {
    return [{ text: value, highlight: false }];
  }

  const lower = value.toLowerCase();
  const matches: { start: number; end: number }[] = [];

  for (const term of normalizedTerms) {
    let index = 0;

    while (index < lower.length) {
      const found = lower.indexOf(term, index);

      if (found === -1) {
        break;
      }

      matches.push({ start: found, end: found + term.length });
      index = found + term.length;
    }
  }

  if (matches.length === 0) {
    return [{ text: value, highlight: false }];
  }

  matches.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];

  for (const match of matches) {
    const last = merged.at(-1);

    if (!last || match.start > last.end) {
      merged.push({ ...match });
      continue;
    }

    last.end = Math.max(last.end, match.end);
  }

  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of merged) {
    if (cursor < match.start) {
      parts.push({
        text: value.slice(cursor, match.start),
        highlight: false,
      });
    }

    parts.push({
      text: value.slice(match.start, match.end),
      highlight: true,
    });
    cursor = match.end;
  }

  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), highlight: false });
  }

  return parts;
}
