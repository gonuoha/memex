type DashboardGreetingProps = {
  firstName: string;
  children?: React.ReactNode;
};

function getTimeOfDayGreeting(date: Date): string {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function DashboardGreeting({
  firstName,
  children,
}: DashboardGreetingProps) {
  const greeting = getTimeOfDayGreeting(new Date());

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {greeting}, {firstName}
      </h1>
      <div className="mt-1 text-sm text-muted-foreground">
        {children ?? "Capture snippets, commands, and links in one place."}
      </div>
    </div>
  );
}
