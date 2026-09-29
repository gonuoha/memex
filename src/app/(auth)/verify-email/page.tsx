import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard
        title="Invalid link"
        description="This verification link is missing a token."
      >
        <p className="text-sm text-muted-foreground">
          Check your email for the latest verification link, or register again if needed.
        </p>
        <Link href="/register" className={cn(buttonVariants(), "mt-4 w-full")}>
          Back to register
        </Link>
      </AuthCard>
    );
  }

  return <VerifyEmailForm token={token} />;
}
