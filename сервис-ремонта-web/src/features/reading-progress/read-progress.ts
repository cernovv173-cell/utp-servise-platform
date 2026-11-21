export const READ_PROGRESS_VISIBILITY_THRESHOLD = 30;

export const calculateReadProgress = (
  scrollTop: number,
  viewportHeight: number,
  documentHeight: number,
): number => {
  const scrollableHeight = Math.max(documentHeight - viewportHeight, 0);
  if (scrollableHeight === 0) return 0;

  return Math.round((Math.min(Math.max(scrollTop, 0), scrollableHeight) / scrollableHeight) * 100);
};

export const shouldShowReadProgressButton = (progress: number): boolean =>
  progress >= READ_PROGRESS_VISIBILITY_THRESHOLD;
