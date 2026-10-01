"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  createShareLink,
  getShareLinkForItem,
  revokeShareLink,
  updateShareLinkExpiry,
  type ShareLinkActionData,
} from "@/actions/share-links";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type ExpiryOption = "null" | "1" | "7" | "30";

function expiryToDays(value: ExpiryOption): number | null {
  if (value === "null") {
    return null;
  }

  return Number(value);
}

function daysToExpiryOption(expiresAt: string | null): ExpiryOption {
  if (!expiresAt) {
    return "null";
  }

  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));

  if (days <= 1) {
    return "1";
  }

  if (days <= 7) {
    return "7";
  }

  return "30";
}

function resetShareState(
  setLink: (value: ShareLinkActionData | null) => void,
  setEnabled: (value: boolean) => void,
  setExpiry: (value: ExpiryOption) => void,
) {
  setLink(null);
  setEnabled(false);
  setExpiry("7");
}

type ItemShareDialogProps = {
  itemId: string;
  itemTitle: string;
};

export function ItemShareDialog({ itemId, itemTitle }: ItemShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [link, setLink] = useState<ShareLinkActionData | null>(null);
  const [expiry, setExpiry] = useState<ExpiryOption>("7");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { copy } = useCopyToClipboard();

  const shareUrl =
    link && typeof window !== "undefined"
      ? `${window.location.origin}/s/${link.token}`
      : "";

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const result = await getShareLinkForItem(itemId);

      if (cancelled) {
        return;
      }

      if (!result.success) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }

      setLink(result.data);
      setEnabled(Boolean(result.data));
      setExpiry(daysToExpiryOption(result.data?.expiresAt ?? null));
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, itemId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (!next) {
      resetShareState(setLink, setEnabled, setExpiry);
    }
  }

  function handleTogglePublic(next: boolean) {
    if (!next) {
      setConfirmRevoke(true);
      return;
    }

    startTransition(async () => {
      const result = await createShareLink(itemId, {
        expiresInDays: expiryToDays(expiry),
        regenerate: false,
      });

      if (!result.success) {
        toast.error(result.error);
        setEnabled(false);
        return;
      }

      setLink(result.data);
      setEnabled(true);
      toast.success("Public link enabled");
    });
  }

  function handleExpiryChange(value: ExpiryOption) {
    setExpiry(value);

    if (!enabled) {
      return;
    }

    startTransition(async () => {
      const result = await updateShareLinkExpiry(
        itemId,
        expiryToDays(value),
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setLink(result.data);
        setExpiry(daysToExpiryOption(result.data.expiresAt));
      }

      toast.success("Expiry updated");
    });
  }

  function handleRegenerateConfirm() {
    startTransition(async () => {
      const result = await createShareLink(itemId, {
        expiresInDays: expiryToDays(expiry),
        regenerate: true,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setLink(result.data);
      setEnabled(true);
      setConfirmRegenerate(false);
      toast.success("Link regenerated");
    });
  }

  function handleRevokeConfirm() {
    startTransition(async () => {
      const result = await revokeShareLink(itemId);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setLink(null);
      setEnabled(false);
      setConfirmRevoke(false);
      toast.success("Public link revoked");
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <Button type="button" variant="outline" size="sm" className="shrink-0">
              <Link2 />
              Share
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share item</DialogTitle>
            <DialogDescription>
              Anyone with the link can view &quot;{itemTitle}&quot; read-only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Expires</Label>
              <Select
                value={expiry}
                onValueChange={(value) =>
                  handleExpiryChange(value as ExpiryOption)
                }
                disabled={isPending || isLoading}
              >
                <SelectTrigger className="w-full" aria-label="Link expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Never</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={`share-public-${itemId}`} className="text-sm">
                Public link
              </Label>
              <Switch
                id={`share-public-${itemId}`}
                checked={enabled}
                disabled={isLoading || isPending}
                onCheckedChange={handleTogglePublic}
              />
            </div>

            {enabled && link ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={shareUrl} aria-label="Share link URL" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copy(shareUrl)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmRegenerate(true)}
                  >
                    <RefreshCw />
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmRevoke(true)}
                  >
                    Revoke
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current URL will stop working immediately. Anyone with the old
              link will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateConfirm}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke public link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable the public URL for this item.
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
    </>
  );
}
