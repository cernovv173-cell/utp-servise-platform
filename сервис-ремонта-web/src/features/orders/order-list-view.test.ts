import { describe, expect, it } from "vitest";

import { archiveForOrderListView, filterOrdersForListView } from "./order-list-view";

const orders = [
  { id: "requested", status: "REQUESTED", archivedAt: null },
  { id: "completed", status: "COMPLETED", archivedAt: null },
  { id: "cancelled", status: "CANCELLED", archivedAt: null },
  { id: "archived", status: "IN_PROGRESS", archivedAt: "2026-10-08T21:00:00.000Z" },
  { id: "archived-completed", status: "COMPLETED", archivedAt: "2026-10-08T21:00:00.000Z" },
];

describe("repair order list views", () => {
  it("separates new, active, completed and archived orders", () => {
    expect(filterOrdersForListView(orders, "new").map((order) => order.id)).toEqual(["requested"]);
    expect(filterOrdersForListView(orders, "active").map((order) => order.id)).toEqual([
      "requested",
    ]);
    expect(filterOrdersForListView(orders, "history").map((order) => order.id)).toEqual([
      "completed",
      "cancelled",
    ]);
    expect(filterOrdersForListView(orders, "archived").map((order) => order.id)).toEqual([
      "archived",
      "archived-completed",
    ]);
  });

  it("requests active data for both current history tabs", () => {
    expect(archiveForOrderListView("new")).toBe("active");
    expect(archiveForOrderListView("active")).toBe("active");
    expect(archiveForOrderListView("history")).toBe("active");
    expect(archiveForOrderListView("archived")).toBe("archived");
  });
});
