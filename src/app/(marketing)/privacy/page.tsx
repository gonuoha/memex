import type { Metadata } from "next";

import {
  LegalContact,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" documentName="Privacy Policy">
      <LegalSection title="Data we process">
        <p>
          Memex stores account information, content you save (snippets,
          prompts, commands, notes, links, files, and related metadata), and
          usage data needed to operate the service.
        </p>
      </LegalSection>

      <LegalSection title="Subprocessors & infrastructure">
        <p>
          Depending on configuration, Memex may use the following providers to
          host and deliver the product:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Neon (PostgreSQL database)</li>
          <li>Cloudflare R2 (file storage)</li>
          <li>Stripe (billing)</li>
          <li>Resend (transactional email)</li>
          <li>Google Gemini (AI features)</li>
          <li>Upstash (rate limiting)</li>
          <li>
            Google favicon service (site icons for saved links; receives the
            link&apos;s hostname only, and can be turned off in Settings)
          </li>
        </ul>
      </LegalSection>

      <LegalContact topic="privacy" />
    </LegalPage>
  );
}
