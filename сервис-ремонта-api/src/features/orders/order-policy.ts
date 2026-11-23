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
  _visitScenarioVersion = 0,
): boolean => {
  if (!transitions[current].includes(next)) return false;
  if (role === "ADMIN") return current === "REQUESTED" && next === "CANCELLED";
  if (role === "CUSTOMER")
    return current === "REQUESTED" && next === "CANCELLED";
  if (current === "IN_PROGRESS" && next === "READY_FOR_PICKUP") return true;
  return current === "ASSIGNED" && next === "IN_PROGRESS";
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

export const isWorkshopRepairOrder = (order: {
  repairLocation: string | null;
  visitScenarioVersion: number;
}): boolean =>
  order.repairLocation === "SERVICE_CENTER" ||
  (order.visitScenarioVersion === 0 && order.repairLocation === null);

export const canManageRepairOrderBonusRedemption = (
  role: UserRole,
  userId: string,
  order: {
    assignedTechnicianId: string | null;
    repairLocation: string | null;
    visitScenarioVersion: number;
  },
): boolean => {
  if (role === "TECHNICIAN") return order.assignedTechnicianId === userId;
  if (role === "ADMIN") return isWorkshopRepairOrder(order);
  return false;
};

export const canAddRepairOrderItem = (
  role: UserRole,
  userId: string,
  order: { assignedTechnicianId: string | null },
): boolean => role === "TECHNICIAN" && order.assignedTechnicianId === userId;

export const calculateMaxBonusDiscount = (
  totalRub: number,
  balancePoints: number,
): number =>
  Math.min(
    Math.max(0, Math.floor(balancePoints)),
    Math.floor((Math.max(0, totalRub) * 3) / 10),
  );

export const calculateServiceBonusEligibleRub = (
  items: readonly { type: string; quantity: number; unitPriceRub: number }[],
): number =>
  items
    .filter((item) => item.type === "SERVICE")
    .reduce(
      (total, item) => total + Math.max(0, item.quantity * item.unitPriceRub),
      0,
    );

export const calculateEarnedPoints = (cashPaidRub: number): number =>
  Math.floor(Math.max(0, cashPaidRub) / 10);
