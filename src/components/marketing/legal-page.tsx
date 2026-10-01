import { MARKETING_CONTACT_EMAIL } from "@/lib/marketing/site";

type LegalPageProps = {
  title: string;
  documentName: string;
  children: React.ReactNode;
};

export function LegalPage({ title, documentName, children }: LegalPageProps) {
  return (
    <article className="mx-auto min-w-0 max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

      <div
        role="note"
        className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
      >
        <p className="font-medium">Template — not yet in effect</p>
        <p className="mt-1 text-muted-foreground">
          This {documentName} is a placeholder draft. It has not been reviewed
          by legal counsel and does not create any binding commitments.
        </p>
      </div>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function LegalContact({ topic }: { topic: string }) {
  return (
    <LegalSection title="Contact">
      <p>
        Questions about {topic} can be sent to{" "}
        <a
          href={`mailto:${MARKETING_CONTACT_EMAIL}`}
          className="text-primary hover:underline"
        >
          {MARKETING_CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalSection>
  );
}
