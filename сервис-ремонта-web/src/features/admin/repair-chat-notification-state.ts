export type RepairChatNoticeCursor = {
  orderId: string;
  lastMessageId: string;
};

export const collectNewRepairChatMessages = <T extends RepairChatNoticeCursor>(
  chats: readonly T[],
  seenMessages: Map<string, string>,
): T[] => {
  const newMessages = chats.filter((chat) => seenMessages.get(chat.orderId) !== chat.lastMessageId);
  for (const chat of chats) seenMessages.set(chat.orderId, chat.lastMessageId);
  return newMessages;
};
