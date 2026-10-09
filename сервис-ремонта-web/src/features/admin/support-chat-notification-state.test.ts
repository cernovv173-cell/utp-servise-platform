import { describe, expect, it } from "vitest";

import { collectNewSupportChatMessages } from "./support-chat-notification-state";

const customerMessage = {
  customer: { id: "customer-1", displayName: "Анна" },
  messages: [{ id: "message-1", content: "Здравствуйте", sender: { role: "CUSTOMER" } }],
};

describe("support chat notifications", () => {
  it("notifies about a new customer message once", () => {
    const seen = new Map<string, string>();

    expect(collectNewSupportChatMessages([customerMessage], seen)).toEqual([customerMessage]);
    expect(collectNewSupportChatMessages([customerMessage], seen)).toEqual([]);
  });

  it("does not alert for administrator replies or empty chats", () => {
    const seen = new Map([["customer-1", "message-1"]]);
    const adminReply = {
      ...customerMessage,
      messages: [{ id: "message-2", content: "Добрый день", sender: { role: "ADMIN" } }],
    };
    const emptyChat = { customer: { id: "customer-2", displayName: "Иван" }, messages: [] };

    expect(collectNewSupportChatMessages([adminReply, emptyChat], seen)).toEqual([]);
    expect(seen.get("customer-1")).toBe("message-2");
  });
});
