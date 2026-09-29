"use client";

import { Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CONFIRMATION_PHRASE = "DELETE";

type DeleteAccountButtonProps = {
  className?: string;
  hasPassword: boolean;
};

export function DeleteAccountButton({
  className,
  hasPassword,
}: DeleteAccountButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmation === CONFIRMATION_PHRASE;
  const canDelete = isConfirmed && (!hasPassword || password.length > 0);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (!open) {
      setConfirmation("");
      setPassword("");
      setIsDeleting(false);
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: CONFIRMATION_PHRASE,
          ...(hasPassword ? { password } : {}),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "Unable to delete account.");
        setIsDeleting(false);
        return;
      }

      await signOut({ callbackUrl: "/sign-in" });
    } catch {
      toast.error("Unable to delete account. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className={cn(className)}
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="size-4" />
        Delete Account
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all your items, collections,
              and tags. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {hasPassword ? (
              <div className="space-y-2">
                <Label htmlFor="deleteAccountPassword">Current password</Label>
                <Input
                  id="deleteAccountPassword"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isDeleting}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="deleteConfirmation">
                Type <span className="font-mono font-medium">{CONFIRMATION_PHRASE}</span> to
                confirm
              </Label>
              <Input
                id="deleteConfirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                disabled={isDeleting}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => void handleDelete()}
                disabled={!canDelete || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Yes, delete my account"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
