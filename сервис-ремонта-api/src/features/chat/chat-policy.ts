import type { UserRole } from "../../generated/prisma/client.js";

export type ChatOrderAccess = {
  readonly customerId: string;
  readonly assignedTechnicianId: string | null;
};

export type ChatEscalationState = {
  readonly adminRequestedAt: Date | null;
  readonly adminJoinedAt: Date | null;
};

export const canAccessOrderChat = (
  role: UserRole,
  userId: string,
  order: ChatOrderAccess,
): boolean =>
  role === "ADMIN" ||
  (role === "CUSTOMER" && order.customerId === userId) ||
  (role === "TECHNICIAN" && order.assignedTechnicianId === userId);

export const canSendOrderChatMessage = (
  role: UserRole,
  userId: string,
  order: ChatOrderAccess,
  chat: ChatEscalationState | null,
): boolean => {
  if (!canAccessOrderChat(role, userId, order)) return false;
  if (role === "ADMIN") return chat?.adminJoinedAt != null;
  return true;
};

export const canRequestAdministratorHelp = (
  role: UserRole,
  userId: string,
  order: ChatOrderAccess,
): boolean => role === "TECHNICIAN" && order.assignedTechnicianId === userId;

export const canJoinEscalatedChat = (
  role: UserRole,
  chat: ChatEscalationState | null,
): boolean => role === "ADMIN" && chat?.adminRequestedAt != null;
