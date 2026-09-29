"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthErrorMessage, AuthInfoMessage } from "@/components/auth/auth-message";
import { OAuthDivider } from "@/components/auth/oauth-divider";
import { sanitizeCallbackUrl } from "@/lib/sanitize-callback-url";

export function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const verified = searchParams.get("verified") === "1";
  const registered = searchParams.get("registered") === "1";
  const passwordReset = searchParams.get("password_reset") === "1";
  const passwordChanged = searchParams.get("password_changed") === "1";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResendMessage(null);
    setShowResendVerification(false);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          callbackUrl,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        code?: string;
        url?: string;
      };

      if (response.status === 429) {
        setError(data.error ?? "Too many attempts. Please try again later.");
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        if (data.code === "email_not_verified") {
          setShowResendVerification(true);
        }

        setError(data.error ?? "Unable to sign in. Please try again.");
        setIsSubmitting(false);
        return;
      }

      window.location.href = data.url ?? callbackUrl;
    } catch {
      setError("Unable to sign in. Please try again.");
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setError(null);
    setResendMessage(null);
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (response.status === 429) {
        setError(data.error ?? "Too many attempts. Please try again later.");
        setIsResending(false);
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Unable to resend verification email.");
        setIsResending(false);
        return;
      }

      setResendMessage(data.message ?? "Verification email sent.");
      setIsResending(false);
    } catch {
      setError("Unable to resend verification email.");
      setIsResending(false);
    }
  }

  function handleGitHubSignIn() {
    void signIn("github", { callbackUrl });
  }

  const urlError =
    authError === "email_not_verified"
      ? "Please verify your email before signing in. Check your inbox for the verification link."
      : authError === "CredentialsSignin"
        ? "Invalid email or password."
        : authError
          ? "Unable to sign in. Please try again."
          : null;

  return (
    <div className="space-y-4">
      {verified ? (
        <AuthInfoMessage>Email verified. Sign in to continue.</AuthInfoMessage>
      ) : null}

      {registered ? (
        <AuthInfoMessage>Account created. Sign in to continue.</AuthInfoMessage>
      ) : null}

      {passwordReset ? (
        <AuthInfoMessage>
          Password reset successfully. Sign in with your new password.
        </AuthInfoMessage>
      ) : null}

      {passwordChanged ? (
        <AuthInfoMessage>
          Password changed successfully. Sign in with your new password.
        </AuthInfoMessage>
      ) : null}

      {urlError || error ? (
        <AuthErrorMessage>{error ?? urlError}</AuthErrorMessage>
      ) : null}

      {resendMessage ? (
        <AuthInfoMessage>{resendMessage}</AuthInfoMessage>
      ) : null}

      {showResendVerification ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleResendVerification}
          disabled={isResending}
        >
          {isResending ? "Sending..." : "Resend verification email"}
        </Button>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <OAuthDivider />

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGitHubSignIn}
        disabled={isSubmitting}
      >
        Sign in with GitHub
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
