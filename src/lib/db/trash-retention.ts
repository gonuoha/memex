export const TRASH_RETENTION_DAYS = 30;

export function getTrashPurgeDeadline(): Date {
  const deadline = new Date();
  deadline.setUTCDate(deadline.getUTCDate() - TRASH_RETENTION_DAYS);
  return deadline;
}

export function daysUntilPermanentDeletion(deletedAt: Date): number {
  const purgeAt = new Date(deletedAt);
  purgeAt.setUTCDate(purgeAt.getUTCDate() + TRASH_RETENTION_DAYS);
  const msRemaining = purgeAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}
