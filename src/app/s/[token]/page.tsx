import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";

import { SharedItemBody } from "@/components/share/shared-item-body";
import { SharedItemCopyButton } from "@/components/share/shared-item-copy-button";
import { Badge } from "@/components/ui/badge";
import { getCachedPublicSharedItemByToken } from "@/lib/db/share-links-public";
import { recordShareLinkView } from "@/lib/db/share-links";
import { formatLongDate } from "@/lib/format-date";
import { getItemCopyText } from "@/lib/item-copy";
import { getItemTypeLabel } from "@/lib/item-type-styles";
import { shouldRecordShareLinkView } from "@/lib/share/record-view";
import { isValidShareLinkTokenFormat } from "@/lib/share-links/token";

type SharedItemPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({
  params,
}: SharedItemPageProps): Promise<Metadata> {
  const { token } = await params;

  if (!isValidShareLinkTokenFormat(token)) {
    return {
      title: "Not found",
      robots: { index: false, follow: false },
    };
  }

  const shared = await getCachedPublicSharedItemByToken(token);

  if (!shared) {
    return {
      title: "Not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: shared.item.title,
    robots: { index: false, follow: false },
  };
}

export async function HEAD({ params }: SharedItemPageProps): Promise<Response> {
  await connection();
  const { token } = await params;

  if (!isValidShareLinkTokenFormat(token)) {
    return new Response(null, { status: 404 });
  }

  const shared = await getCachedPublicSharedItemByToken(token);

  if (!shared) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, { status: 200 });
}

export default async function SharedItemPage({ params }: SharedItemPageProps) {
  await connection();

  const { token } = await params;

  if (!isValidShareLinkTokenFormat(token)) {
    notFound();
  }

  const shared = await getCachedPublicSharedItemByToken(token);

  if (!shared) {
    notFound();
  }

  const userAgent = (await headers()).get("user-agent");

  if (shouldRecordShareLinkView("GET", userAgent)) {
    after(() => {
      recordShareLinkView(shared.shareLinkId).catch((error) => {
        console.error("Failed to record share link view:", error);
      });
    });
  }

  const { item } = shared;
  const copyText = getItemCopyText({
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {getItemTypeLabel(item.typeName)}
            </Badge>
            {item.language ? (
              <Badge variant="secondary">{item.language}</Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {item.title}
          </h1>
          {item.description ? (
            <p className="text-muted-foreground">{item.description}</p>
          ) : null}
          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          ) : null}
        </header>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Content</h2>
            <SharedItemCopyButton text={copyText} />
          </div>
          <SharedItemBody item={item} />
        </section>

        <footer className="space-y-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            Created {formatLongDate(item.createdAt)} · Updated{" "}
            {formatLongDate(item.updatedAt)}
          </p>
          <p>
            Shared with{" "}
            <span className="font-medium text-foreground">Memex</span>
            {" — "}
            <Link href="/register" className="text-primary underline-offset-4 hover:underline">
              Create your free account
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
