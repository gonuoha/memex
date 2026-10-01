"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

import { createApiKey, revokeApiKey } from "@/actions/api-keys";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { ApiKeyListEntry } from "@/lib/db/api-keys";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type ApiKeysCardProps = {
  isPro: boolean;
  initialKeys: ApiKeyListEntry[];
};

type ExpiryOption = "never" | "30" | "90" | "365";

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function keyStatus(key: ApiKeyListEntry): "active" | "revoked" | "expired" {
  if (key.revokedAt) {
    return "revoked";
  }

  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function normalizeKey(key: ApiKeyListEntry): ApiKeyListEntry {
  return {
    ...key,
    lastUsedAt: toDate(key.lastUsedAt),
    expiresAt: toDate(key.expiresAt),
    revokedAt: toDate(key.revokedAt),
    createdAt: toDate(key.createdAt) ?? new Date(),
  };
}

export function ApiKeysCard({ isPro, initialKeys }: ApiKeysCardProps) {
  const router = useRouter();
  const { copied, copy } = useCopyToClipboard();
  const [keys, setKeys] = useState(() => initialKeys.map(normalizeKey));
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("never");
  const [isCreating, setIsCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyListEntry | null>(
    null,
  );
  const [isRevoking, setIsRevoking] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function openCreateDialog() {
    setName("");
    setExpiry("never");
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleCreate(event?: React.FormEvent) {
    event?.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const expiresInDays =
        expiry === "never" ? null : Number.parseInt(expiry, 10);

      const result = await createApiKey({
        name,
        expiresInDays,
      });

      if (!result.success) {
        setCreateError(result.error);
        return;
      }

      setCreateOpen(false);
      setRevealedKey(result.data.plaintextKey);
      setKeys((current) => [
        {
          id: result.data.id,
          name: result.data.name,
          prefix: result.data.prefix,
          lastUsedAt: null,
          expiresAt: result.data.expiresAt,
          revokedAt: null,
          createdAt: result.data.createdAt,
        },
        ...current,
      ]);
      router.refresh();
    } catch {
      setCreateError("Something went wrong while creating the API key.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) {
      return;
    }

    setIsRevoking(true);

    try {
      const result = await revokeApiKey(revokeTarget.id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setKeys((current) =>
        current.map((key) =>
          key.id === revokeTarget.id
            ? { ...key, revokedAt: new Date() }
            : key,
        ),
      );
      setRevokeTarget(null);
      router.refresh();
      toast.success("API key revoked");
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <>
      <PageSection
        title="API keys"
        description="Manage personal API keys for the Memex REST API. Changing your password revokes all keys."
        action={
          isPro ? (
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="size-4" />
              Create key
            </Button>
          ) : undefined
        }
      >
        {!isPro ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <KeyRound className="size-4" />
              Creating keys requires Pro
            </p>
            <p className="mt-2">
              You can still view and revoke existing keys. Upgrade to create new
              keys.
            </p>
            <Button
              className="mt-4"
              size="sm"
              render={<Link href="/upgrade" />}
            >
              Upgrade to Pro
            </Button>
          </div>
        ) : null}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No API keys yet.{isPro ? " Create one to get started." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {keys.map((key) => {
              const status = keyStatus(key);

              return (
                <li
                  key={key.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{key.name}</p>
                      <Badge variant={status === "active" ? "secondary" : "outline"}>
                        {status}
                      </Badge>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground">
                      {key.prefix}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDateTime(key.createdAt)} · Last used{" "}
                      {formatDateTime(key.lastUsedAt)} · Expires{" "}
                      {formatDateTime(key.expiresAt)}
                    </p>
                  </div>
                  {status === "active" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setRevokeTarget(key)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-sm text-muted-foreground">
          Read the{" "}
          <Link href="/docs/api" className="text-primary hover:underline">
            API documentation
          </Link>{" "}
          for authentication and endpoints.
        </p>
      </PageSection>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Name your key and choose when it should expire.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="CI deploy"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label id="api-key-expiry-label">Expires</Label>
              <Select
                value={expiry}
                onValueChange={(value) => setExpiry(value as ExpiryOption)}
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="api-key-expiry-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">365 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError ? (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="submit"
                disabled={isCreating || name.trim().length === 0}
              >
                {isCreating ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={revealedKey !== null} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy this key now. You won&apos;t see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Store this key securely. Anyone with it can access your Memex data
            via the API.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              {revealedKey}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (revealedKey) {
                  void copy(revealedKey);
                }
              }}
              aria-label="Copy API key"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="sr-only" aria-live="polite">
            {copied ? "Copied" : ""}
          </p>
          <DialogFooter>
            <Button type="button" onClick={() => setRevealedKey(null)}>
              I&apos;ve copied it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Requests using &quot;{revokeTarget?.name}&quot; will stop working
              immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                void handleRevoke();
              }}
              disabled={isRevoking}
            >
              {isRevoking ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
