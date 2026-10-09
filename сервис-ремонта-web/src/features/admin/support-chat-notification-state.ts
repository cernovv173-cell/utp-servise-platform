export type SupportChatNotice = {
  customer: { id: string; displayName: string };
  messages: Array<{
    id: string;
    content: string;
    sender: { role: string } | null;
  }>;
};

export const collectNewSupportChatMessages = <T extends SupportChatNotice>(
  chats: readonly T[],
  seenMessages: Map<string, string>,
): T[] => {
  const newMessages = chats.filter((chat) => {
    const latestMessage = chat.messages[0];
    if (!latestMessage) return false;

    const isNew = seenMessages.get(chat.customer.id) !== latestMessage.id;
    seenMessages.set(chat.customer.id, latestMessage.id);
    return isNew && latestMessage.sender?.role === "CUSTOMER";
  });

  return newMessages;
};
