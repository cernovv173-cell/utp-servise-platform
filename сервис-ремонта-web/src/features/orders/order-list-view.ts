import type { RepairOrder } from "@/lib/api";

export type OrderListView = "new" | "active" | "history" | "archived";

export const isOrderListView = (value: unknown): value is OrderListView =>
  value === "new" || value === "active" || value === "history" || value === "archived";

export const archiveForOrderListView = (view: OrderListView) =>
  view === "archived" ? "archived" : "active";

export const filterOrdersForListView = <T extends Pick<RepairOrder, "archivedAt" | "status">>(
  orders: readonly T[],
  view: OrderListView,
) =>
  orders.filter((order) => {
    if (view === "archived") return Boolean(order.archivedAt);
    if (order.archivedAt) return false;
    if (view === "new") return order.status === "REQUESTED";
    const isHistory = order.status === "COMPLETED" || order.status === "CANCELLED";
    return view === "history" ? isHistory : !isHistory;
  });
