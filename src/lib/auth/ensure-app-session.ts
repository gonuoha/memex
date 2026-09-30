import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { sanitizeCallbackUrl } from "@/lib/sanitize-callback-url";

export async function ensureAppSession(): Promise<void> {
  const session = await auth();

  if (session?.user?.id) {
    return;
  }

  const headerStore = await headers();
  const pathname =
    headerStore.get("x-pathname") ??
    headerStore.get("next-url") ??
    "/dashboard";
  const callbackUrl = sanitizeCallbackUrl(pathname);

  redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
