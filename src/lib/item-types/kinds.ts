export const ITEM_TYPE_KINDS = [
  "code",
  "markdown",
  "link",
  "file",
  "image",
] as const;

export type ItemTypeKind = (typeof ITEM_TYPE_KINDS)[number];

export const CUSTOM_CREATABLE_KINDS = ["code", "markdown", "link"] as const;

export type CustomCreatableKind = (typeof CUSTOM_CREATABLE_KINDS)[number];

export const SYSTEM_KIND_BY_NAME: Record<string, ItemTypeKind> = {
  snippet: "code",
  command: "code",
  prompt: "markdown",
  note: "markdown",
  link: "link",
  file: "file",
  image: "image",
};

export type ItemTypeBehaviour = {
  usesCodeEditor: boolean;
  usesMarkdownEditor: boolean;
  usesUrlField: boolean;
  usesLanguageField: boolean;
  usesFileUpload: boolean;
  isGalleryView: boolean;
};

export function normalizeItemTypeKind(kind: string): ItemTypeKind {
  const normalized = kind.toLowerCase();

  if ((ITEM_TYPE_KINDS as readonly string[]).includes(normalized)) {
    return normalized as ItemTypeKind;
  }

  return "markdown";
}

export function getSystemKindForName(name: string): ItemTypeKind {
  return SYSTEM_KIND_BY_NAME[name.toLowerCase()] ?? "markdown";
}

export function getItemTypeBehaviour(kind: ItemTypeKind): ItemTypeBehaviour {
  return {
    usesCodeEditor: kind === "code",
    usesMarkdownEditor: kind === "markdown",
    usesUrlField: kind === "link",
    usesLanguageField: kind === "code",
    usesFileUpload: kind === "file" || kind === "image",
    isGalleryView: kind === "file" || kind === "image",
  };
}

export function kindsCompatibleForMove(
  from: ItemTypeKind,
  to: ItemTypeKind,
): boolean {
  return from === to;
}
