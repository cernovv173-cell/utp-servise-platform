import type { RepairStatus, UserRole } from "../../generated/prisma/client.js";

const transitions: Readonly<Record<RepairStatus, readonly RepairStatus[]>> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const canTransitionRepairStatus = (
  role: UserRole,
  current: RepairStatus,
  next: RepairStatus,
): boolean => {
  if (!transitions[current].includes(next)) return false;
  if (role === "ADMIN") return true;
  if (role === "CUSTOMER")
    return current === "REQUESTED" && next === "CANCELLED";
  return (
    (current === "ASSIGNED" && next === "IN_PROGRESS") ||
    (current === "IN_PROGRESS" && next === "READY_FOR_PICKUP")
  );
};

export const canViewRepairOrder = (
  role: UserRole,
  userId: string,
  order: { customerId: string; assignedTechnicianId: string | null },
): boolean => {
  if (role === "ADMIN") return true;
  if (role === "CUSTOMER") return order.customerId === userId;
  return order.assignedTechnicianId === userId;
};

export const canAddRepairOrderItem = (
  role: UserRole,
  userId: string,
  order: { assignedTechnicianId: string | null },
): boolean =>
  role === "ADMIN" ||
  (role === "TECHNICIAN" && order.assignedTechnicianId === userId);

export const calculateMaxBonusDiscount = (
  totalRub: number,
  balancePoints: number,
): number =>
  Math.min(
    Math.max(0, Math.floor(balancePoints)),
    Math.floor((Math.max(0, totalRub) * 3) / 10),
  );

export const calculateEarnedPoints = (cashPaidRub: number): number =>
  Math.floor(Math.max(0, cashPaidRub) / 10);
