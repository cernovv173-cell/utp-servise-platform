import type { RepairOrder } from "@/lib/api";

export type OrderListView = "active" | "history" | "archived";

export const archiveForOrderListView = (view: OrderListView) =>
  view === "archived" ? "archived" : "active";

export const filterOrdersForListView = <T extends Pick<RepairOrder, "archivedAt" | "status">>(
  orders: readonly T[],
  view: OrderListView,
) =>
  orders.filter((order) => {
    if (view === "archived") return Boolean(order.archivedAt);
    if (order.archivedAt) return false;
    const isHistory = order.status === "COMPLETED" || order.status === "CANCELLED";
    return view === "history" ? isHistory : !isHistory;
  });
