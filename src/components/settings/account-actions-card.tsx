"use client";

import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";

import { PageSection } from "@/components/layout/page-container";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DeleteAccountButton } from "@/components/profile/delete-account-button";
import { SendPasswordResetButton } from "@/components/settings/send-password-reset-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AccountActionsCardProps = {
  email: string;
  hasPassword: boolean;
};

export function AccountActionsCard({ email, hasPassword }: AccountActionsCardProps) {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <PageSection
      title="Account Actions"
      description="Manage your password and account security."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {hasPassword ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:min-w-[12rem]"
              onClick={() => setChangePasswordOpen(true)}
            >
              <KeyRound className="size-4" />
              Change Password
            </Button>
            <SendPasswordResetButton
              email={email}
              className="flex-1 sm:min-w-[12rem]"
            />
            <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change password</DialogTitle>
                </DialogHeader>
                <ChangePasswordForm
                  onSuccess={() => setChangePasswordOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span>
              You signed in with GitHub. Password management is not available.
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          Permanently remove your account and all associated data.
        </p>
        <DeleteAccountButton
          className="mt-3 sm:w-auto"
          hasPassword={hasPassword}
        />
      </div>
    </PageSection>
  );
}
