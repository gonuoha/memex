import { getAppUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/escape-html";
import { getFromEmail, getResend } from "@/lib/email/resend";

type SendVerificationEmailParams = {
  email: string;
  name: string;
  token: string;
};

function buildVerifyEmailUrl(token: string): string {
  const url = new URL("/verify-email", getAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendVerificationEmail({
  email,
  name,
  token,
}: SendVerificationEmailParams): Promise<void> {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(buildVerifyEmailUrl(token));

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: email,
    subject: "Verify your Memex account",
    html: `
      <p>Hi ${safeName},</p>
      <p>Thanks for signing up for Memex. Click the link below to verify your email address:</p>
      <p><a href="${safeUrl}">Verify email</a></p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
