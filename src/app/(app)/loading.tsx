export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-lg border border-border/60 bg-muted/40"
          />
        ))}
      </div>
    </div>
  );
}
