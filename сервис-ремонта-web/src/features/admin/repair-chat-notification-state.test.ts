import { describe, expect, it } from "vitest";

import { collectNewRepairChatMessages } from "./repair-chat-notification-state";

describe("repair chat notifications", () => {
  it("announces a new chat after the initial unread snapshot was empty", () => {
    const seen = new Map<string, string>();
    const chat = { orderId: "order-1", lastMessageId: "message-1" };

    expect(collectNewRepairChatMessages([chat], seen)).toEqual([chat]);
  });

  it("does not repeat the same notification and detects the next message", () => {
    const seen = new Map([["order-1", "message-1"]]);
    const sameMessage = { orderId: "order-1", lastMessageId: "message-1" };
    const nextMessage = { orderId: "order-1", lastMessageId: "message-2" };

    expect(collectNewRepairChatMessages([sameMessage], seen)).toEqual([]);
    expect(collectNewRepairChatMessages([nextMessage], seen)).toEqual([nextMessage]);
    expect(collectNewRepairChatMessages([nextMessage], seen)).toEqual([]);
  });
});
