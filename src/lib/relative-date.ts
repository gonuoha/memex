const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export function formatRelativeDate(
  date: Date,
  now: Date = new Date(),
): string {
  const then = date.getTime();
  const reference = now.getTime();
  const diffMs = reference - then;

  if (diffMs < 0) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMs / MS_PER_HOUR);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffMs / MS_PER_DAY);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return `${diffWeeks}w ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}
