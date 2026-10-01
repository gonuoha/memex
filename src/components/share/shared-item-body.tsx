import { SharedMarkdownContent } from "@/components/share/shared-markdown-content";
import type { PublicSharedItem } from "@/lib/db/share-links";
import { isSafeHttpUrl } from "@/lib/share/safe-url";

const CODE_TYPES = new Set(["snippet", "command"]);
const MARKDOWN_TYPES = new Set(["note", "prompt"]);

type SharedItemBodyProps = {
  item: PublicSharedItem;
};

export function SharedItemBody({ item }: SharedItemBodyProps) {
  const typeName = item.typeName.toLowerCase();

  if (typeName === "link" && item.url) {
    if (!isSafeHttpUrl(item.url)) {
      return <p className="text-sm">{item.url}</p>;
    }

    return (
      <p className="text-sm">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-primary underline-offset-4 hover:underline"
        >
          {item.url}
        </a>
      </p>
    );
  }

  if (!item.content) {
    return null;
  }

  if (CODE_TYPES.has(typeName)) {
    const lang = item.language?.trim() || "text";

    return (
      <pre
        className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm leading-relaxed"
      >
        <code className={`language-${lang}`}>{item.content}</code>
      </pre>
    );
  }

  if (MARKDOWN_TYPES.has(typeName)) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <SharedMarkdownContent content={item.content} />
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
      {item.content}
    </pre>
  );
}
