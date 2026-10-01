"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

import { revokeShareLink } from "@/actions/share-links";
import { PageSection } from "@/components/layout/page-container";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { formatLongDate } from "@/lib/format-date";

type SharedLinkRow = {
  id: string;
  itemId: string;
  token: string;
  itemTitle: string;
  itemTypeName: string;
  createdAt: string | Date;
  expiresAt: string | Date | null;
  viewCount: number;
};

type SharedLinksCardProps = {
  links: SharedLinkRow[];
};

function formatExpiry(expiresAt: string | Date | null): string {
  if (!expiresAt) {
    return "Never";
  }

  return formatLongDate(expiresAt);
}

export function SharedLinksCard({ links }: SharedLinksCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [revokeItemId, setRevokeItemId] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();

  function shareUrl(token: string): string {
    if (typeof window === "undefined") {
      return `/s/${token}`;
    }

    return `${window.location.origin}/s/${token}`;
  }

  function handleRevokeConfirm() {
    if (!revokeItemId) {
      return;
    }

    startTransition(async () => {
      const result = await revokeShareLink(revokeItemId);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Share link revoked");
      setRevokeItemId(null);
      router.refresh();
    });
  }

  return (
    <PageSection
      title="Shared links"
      description="Active public links for your items. Revoke any link to disable access immediately."
      contentClassName="space-y-4"
    >
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active share links. Enable sharing from an item&apos;s drawer.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{link.itemTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {link.itemTypeName} · Created {formatLongDate(link.createdAt)}{" "}
                  · Expires {formatExpiry(link.expiresAt)} · {link.viewCount}{" "}
                  view{link.viewCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(shareUrl(link.token))}
                >
                  <Link2 />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={shareUrl(link.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ExternalLink />
                  Open
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setRevokeItemId(link.itemId)}
                >
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={revokeItemId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeItemId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this share link?</AlertDialogTitle>
            <AlertDialogDescription>
              The public URL will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeConfirm}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageSection>
  );
}
