const PLURAL_SLUG_BY_TYPE: Record<string, string> = {
  snippet: "snippets",
  prompt: "prompts",
  command: "commands",
  note: "notes",
  file: "files",
  image: "images",
  link: "links",
};

const SINGULAR_ALIASES: Record<string, string> = {
  snippets: "snippet",
  snippet: "snippet",
  prompts: "prompt",
  prompt: "prompt",
  commands: "command",
  command: "command",
  notes: "note",
  note: "note",
  files: "file",
  file: "file",
  images: "image",
  image: "image",
  links: "link",
  link: "link",
  url: "link",
  urls: "link",
};

/** Canonical plural URL segment for an item type name (e.g. `snippet` → `snippets`). */
export function getTypeSlug(typeName: string): string {
  const normalized = typeName.toLowerCase();
  return PLURAL_SLUG_BY_TYPE[normalized] ?? `${normalized}s`;
}

/** Resolves a URL slug to a canonical item type name, or `null` if unknown. */
export function parseItemTypeSlug(slug: string): string | null {
  return SINGULAR_ALIASES[slug.toLowerCase()] ?? null;
}

export function getCanonicalItemTypeSlug(slug: string): string | null {
  const typeName = parseItemTypeSlug(slug);
  return typeName ? getTypeSlug(typeName) : null;
}
