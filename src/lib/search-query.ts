export type ParsedSearchQuery = {
  text: string;
  typeSlug: string | null;
  tag: string | null;
};

const TYPE_PREFIX = /^type:([a-z][a-z0-9_-]*)$/i;
const TAG_PREFIX = /^tag:([a-z0-9][a-z0-9_-]*)$/i;
const HASH_TAG = /^#([a-z0-9][a-z0-9_-]*)$/i;

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  let typeSlug: string | null = null;
  let tag: string | null = null;
  const textParts: string[] = [];

  const tokens = raw.trim().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const typeMatch = TYPE_PREFIX.exec(token);

    if (typeMatch) {
      typeSlug = typeMatch[1].toLowerCase();
      continue;
    }

    const tagMatch = TAG_PREFIX.exec(token);

    if (tagMatch) {
      tag = tagMatch[1].toLowerCase();
      continue;
    }

    const hashMatch = HASH_TAG.exec(token);

    if (hashMatch) {
      tag = hashMatch[1].toLowerCase();
      continue;
    }

    textParts.push(token);
  }

  return {
    text: textParts.join(" ").trim(),
    typeSlug,
    tag,
  };
}

const TSQUERY_TERM = /^[a-zA-Z0-9_]+$/;

export function getSearchTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => TSQUERY_TERM.test(term));
}

/** Builds a prefix-friendly `simple` tsquery string (e.g. `react:* & hook:*`). */
export function buildPrefixTsQuery(text: string): string | null {
  const terms = getSearchTerms(text);

  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `${term}:*`).join(" & ");
}

export function getHighlightTerms(parsed: ParsedSearchQuery): string[] {
  const terms = getSearchTerms(parsed.text);

  if (parsed.tag) {
    terms.push(parsed.tag);
  }

  return [...new Set(terms)];
}
