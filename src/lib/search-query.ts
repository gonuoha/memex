export type ParsedSearchQuery = {
  text: string;
  typeSlug: string | null;
  tag: string | null;
};

const MAX_TAG_LENGTH = 40;
const MAX_TSQUERY_TERMS = 8;

const TYPE_PREFIX = /^type:([a-z][a-z0-9_-]*)$/i;
const TAG_PREFIX = /^tag:(\S+)$/i;
const HASH_TAG = /^#(\S+)$/;
const SEARCH_TERM = /[\p{L}\p{N}]+/gu;

const TYPE_ALIASES: Record<string, string> = {
  url: "link",
  urls: "link",
  bookmark: "link",
  bookmarks: "link",
  code: "snippet",
  cmd: "command",
  img: "image",
};

function normalizeTag(value: string): string | null {
  const tag = value.toLowerCase();

  return tag.length <= MAX_TAG_LENGTH ? tag : null;
}

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

    const tagMatch = TAG_PREFIX.exec(token) ?? HASH_TAG.exec(token);
    const parsedTag = tagMatch ? normalizeTag(tagMatch[1]) : null;

    if (parsedTag) {
      tag = parsedTag;
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

/** Item type names are singular (`link`, `snippet`); users often type plurals or `url`. */
export function getTypeNameCandidates(typeSlug: string): string[] {
  const slug = typeSlug.toLowerCase();
  const candidates = [slug];
  const alias = TYPE_ALIASES[slug];

  if (alias) {
    candidates.push(alias);
  }

  if (slug.length > 1 && slug.endsWith("s")) {
    candidates.push(slug.slice(0, -1));
  }

  return [...new Set(candidates)];
}

/** Letters and digits only, so terms never contain tsquery operators, quotes, or backslashes. */
export function getSearchTerms(text: string): string[] {
  return [...new Set(text.toLowerCase().match(SEARCH_TERM) ?? [])];
}

/** Builds a prefix-friendly `simple` tsquery string (e.g. `react:* & hook:*`). */
export function buildPrefixTsQuery(text: string): string | null {
  const terms = getSearchTerms(text).slice(0, MAX_TSQUERY_TERMS);

  if (terms.length === 0) {
    return null;
  }

  return terms.map((term) => `${term}:*`).join(" & ");
}

export function buildContainsLikePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

export function getHighlightTerms(parsed: ParsedSearchQuery): string[] {
  const terms = getSearchTerms(parsed.text);

  if (parsed.tag) {
    terms.push(parsed.tag);
  }

  return [...new Set(terms)];
}
