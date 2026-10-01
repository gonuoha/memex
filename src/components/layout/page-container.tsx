import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
};

export function PageContainer({ children, className, wide }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-8",
        wide ? "max-w-2xl lg:max-w-7xl" : "max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={className}>
      <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

type SectionHeadingProps = {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeading({
  children,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-3 flex min-h-8 items-center justify-between gap-3",
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

type PageContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>{children}</div>
  );
}

type PageSectionProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PageSection({
  title,
  description,
  children,
  action,
  className,
  contentClassName,
}: PageSectionProps) {
  const hasHeader = title || description || action;

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div
        className={cn(hasHeader ? "mt-4" : undefined, contentClassName)}
      >
        {children}
      </div>
    </section>
  );
}
