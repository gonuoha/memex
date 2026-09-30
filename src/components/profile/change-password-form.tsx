"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPasswordPolicyError,
  PASSWORD_POLICY_HINT,
} from "@/lib/validations/password";

type ChangePasswordFormProps = {
  onSuccess?: () => void;
};

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required.");
      return;
    }

    const passwordError = getPasswordPolicyError(newPassword);

    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = (await response.json()) as {
        error?: string;
        signOutRequired?: boolean;
      };

      if (!response.ok) {
        toast.error(data.error ?? "Unable to change password.");
        setIsSubmitting(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess?.();

      if (data.signOutRequired) {
        toast.success("Password updated. Please sign in again with your new password.");
        await signOut({ callbackUrl: "/sign-in?password_changed=1" });
        return;
      }

      toast.success("Password updated successfully.");
    } catch {
      toast.error("Unable to change password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={isSubmitting}
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">Confirm new password</Label>
        <Input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isSubmitting}
          minLength={8}
        />
      </div>

      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
