import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SharedMarkdownContentProps = {
  content: string;
};

export function SharedMarkdownContent({ content }: SharedMarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ src, alt }) => {
          const href = typeof src === "string" ? src : undefined;

          if (!href) {
            return null;
          }

          return (
            <a href={href} rel="noopener noreferrer nofollow">
              {alt?.trim() ? alt : "Image link"}
            </a>
          );
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
