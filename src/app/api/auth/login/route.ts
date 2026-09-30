import { AuthError } from "next-auth";
import { NextResponse } from "next/server";

import { signIn } from "@/auth";
import { checkLoginRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { sanitizeCallbackUrl } from "@/lib/sanitize-callback-url";
import { normalizeEmail } from "@/lib/validate-email";

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
  callbackUrl?: unknown;
};

export async function POST(request: Request) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const callbackUrl = sanitizeCallbackUrl(
    typeof body.callbackUrl === "string" ? body.callbackUrl : undefined,
  );

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const rateLimit = await checkLoginRateLimit(request, email);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: callbackUrl,
    });

    if (result?.url?.includes("email_not_verified")) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before signing in. Check your inbox for the verification link.",
          code: "email_not_verified",
        },
        { status: 403 },
      );
    }

    if (result?.error) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    return NextResponse.json({ success: true, url: result?.url ?? callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
    }

    throw error;
  }
}
