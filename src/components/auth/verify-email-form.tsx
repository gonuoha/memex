"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VerifyEmailFormProps = {
  token: string;
};

export function VerifyEmailForm({ token }: VerifyEmailFormProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "expired" | "invalid"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleVerify() {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = (await response.json()) as { error?: string; code?: string };

      if (response.ok) {
        setStatus("success");
        return;
      }

      if (data.code === "expired") {
        setStatus("expired");
        return;
      }

      setStatus("invalid");
      setErrorMessage(data.error ?? "Unable to verify email.");
    } catch {
      setStatus("invalid");
      setErrorMessage("Unable to verify email. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <AuthCard title="Email verified" description="Your account is ready to use">
        <p className="text-sm text-muted-foreground">
          Thanks for confirming your email address. You can now sign in to Memex.
        </p>
        <Link href="/sign-in?verified=1" className={cn(buttonVariants(), "mt-4 w-full")}>
          Sign in
        </Link>
      </AuthCard>
    );
  }

  if (status === "expired") {
    return (
      <AuthCard title="Link expired" description="This verification link has expired">
        <p className="text-sm text-muted-foreground">
          Verification links expire after 24 hours. Sign in with your email and password to
          request a new verification email.
        </p>
        <Link href="/sign-in" className={cn(buttonVariants(), "mt-4 w-full")}>
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthCard title="Invalid link" description="This verification link is not valid">
        <p className="text-sm text-muted-foreground">
          {errorMessage ??
            "The link may have already been used or is incorrect. Check your email for the latest verification link."}
        </p>
        <Link href="/sign-in" className={cn(buttonVariants(), "mt-4 w-full")}>
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verify your email" description="Confirm your Memex account">
      <p className="text-sm text-muted-foreground">
        Click the button below to verify your email address. This step is required before you
        can sign in.
      </p>
      <Button
        type="button"
        className="mt-4 w-full"
        onClick={() => void handleVerify()}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Verifying..." : "Verify my email"}
      </Button>
    </AuthCard>
  );
}
