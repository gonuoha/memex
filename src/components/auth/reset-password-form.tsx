"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthErrorMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPasswordPolicyError,
  PASSWORD_POLICY_HINT,
} from "@/lib/validations/password";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }

    const passwordError = getPasswordPolicyError(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = (await response.json()) as { error?: string };

      if (response.status === 429) {
        setError(data.error ?? "Too many attempts. Please try again later.");
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Unable to reset password. Please try again.");
        setIsSubmitting(false);
        return;
      }

      router.push("/sign-in?password_reset=1");
    } catch {
      setError("Unable to reset password. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <AuthErrorMessage>{error}</AuthErrorMessage> : null}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Resetting..." : "Reset password"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
