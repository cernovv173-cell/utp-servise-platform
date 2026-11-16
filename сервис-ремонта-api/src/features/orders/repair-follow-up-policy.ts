export const REPAIR_FOLLOW_UP_DELAY_MILLISECONDS = 48 * 60 * 60 * 1_000;

export const getRepairFollowUpScheduledAt = (
  completedAt: Date = new Date(),
): Date =>
  new Date(completedAt.getTime() + REPAIR_FOLLOW_UP_DELAY_MILLISECONDS);
