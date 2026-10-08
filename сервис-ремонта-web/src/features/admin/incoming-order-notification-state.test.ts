import { describe, expect, it } from "vitest";

import { collectIncomingOrderChanges } from "./incoming-order-notification-state";

describe("collectIncomingOrderChanges", () => {
  it("uses the first response as a baseline without notifying about existing orders", () => {
    expect(collectIncomingOrderChanges(["repair-1", "craft-1"], null)).toEqual({
      newlySeenIds: [],
      rememberedIds: ["repair-1", "craft-1"],
    });
  });

  it("returns only order IDs that were not in the previous snapshot", () => {
    expect(collectIncomingOrderChanges(["repair-2", "repair-1"], ["repair-1"])).toEqual({
      newlySeenIds: ["repair-2"],
      rememberedIds: ["repair-2", "repair-1"],
    });
  });

  it("keeps previously seen orders remembered when the latest-order window changes", () => {
    expect(collectIncomingOrderChanges(["repair-2"], ["repair-1"])).toEqual({
      newlySeenIds: ["repair-2"],
      rememberedIds: ["repair-2", "repair-1"],
    });
  });
});
