"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { AuthErrorMessage, AuthInfoMessage } from "@/components/auth/auth-message";
import { OAuthDivider } from "@/components/auth/oauth-divider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_POLICY_HINT } from "@/lib/validations/password";
import { isValidEmail } from "@/lib/validate-email";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        verificationRequired?: boolean;
      };

      if (response.status === 429) {
        setError(data.error ?? "Too many attempts. Please try again later.");
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Unable to create account.");
        setIsSubmitting(false);
        return;
      }

      if (data.verificationRequired === false) {
        router.push("/sign-in?registered=1");
        return;
      }

      setIsComplete(true);
    } catch {
      setError("Unable to create account. Please try again.");
      setIsSubmitting(false);
    }
  }

  function handleGitHubSignUp() {
    void signIn("github", { callbackUrl: "/dashboard" });
  }

  if (isComplete) {
    return (
      <div className="space-y-4">
        <AuthInfoMessage>
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          Click the link in your email to activate your account.
        </AuthInfoMessage>
        <p className="text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <AuthErrorMessage>{error}</AuthErrorMessage> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            maxLength={100}
          />
        </div>

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
          <Label htmlFor="password">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSubmitting}
            minLength={8}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <OAuthDivider />

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGitHubSignUp}
        disabled={isSubmitting}
      >
        Sign up with GitHub
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
