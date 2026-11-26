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
  canManageCommunications = false,
  hasRepairAccess = false,
): boolean =>
  role === "ADMIN" ||
  (role !== "CUSTOMER" && canManageCommunications) ||
  (role === "CUSTOMER" && order.customerId === userId) ||
  (role === "TECHNICIAN" &&
    hasRepairAccess &&
    order.assignedTechnicianId === userId);

export const canSendOrderChatMessage = (
  role: UserRole,
  userId: string,
  order: ChatOrderAccess,
  chat: ChatEscalationState | null,
  canManageCommunications = false,
  hasRepairAccess = false,
): boolean => {
  if (
    !canAccessOrderChat(
      role,
      userId,
      order,
      canManageCommunications,
      hasRepairAccess,
    )
  )
    return false;
  if (role === "ADMIN" || canManageCommunications)
    return chat?.adminJoinedAt != null;
  return true;
};

export const canRequestAdministratorHelp = (
  role: UserRole,
  userId: string,
  order: ChatOrderAccess,
  hasRepairAccess = false,
): boolean =>
  role === "TECHNICIAN" &&
  hasRepairAccess &&
  order.assignedTechnicianId === userId;
