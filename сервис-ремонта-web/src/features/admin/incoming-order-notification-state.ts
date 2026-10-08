const MAX_REMEMBERED_ORDER_IDS = 1_000;

export const collectIncomingOrderChanges = (
  currentOrderIds: string[],
  previouslySeenIds: string[] | null,
) => {
  const previouslySeen = new Set(previouslySeenIds ?? []);
  const uniqueCurrentIds = [...new Set(currentOrderIds)];
  const newlySeenIds = previouslySeenIds
    ? uniqueCurrentIds.filter((id) => !previouslySeen.has(id))
    : [];
  const rememberedIds = [...new Set([...uniqueCurrentIds, ...(previouslySeenIds ?? [])])].slice(
    0,
    MAX_REMEMBERED_ORDER_IDS,
  );

  return { newlySeenIds, rememberedIds };
};
