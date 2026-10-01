import type { Metadata } from "next";

import {
  LegalContact,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" documentName="Terms of Service">
      <LegalSection title="Service description">
        <p>
          Memex provides a hosted workspace for organizing developer knowledge
          including snippets, prompts, commands, notes, links, and files.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>
          The service relies on infrastructure and integrations such as Neon,
          Cloudflare R2, Stripe, Resend, Google Gemini, and Upstash. Your use of
          Memex may also be subject to those providers&apos; terms where
          applicable.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You agree not to misuse the service, attempt unauthorized access, or
          upload unlawful content. The operator may suspend accounts that
          violate these terms.
        </p>
      </LegalSection>

      <LegalContact topic="these terms" />
    </LegalPage>
  );
}
