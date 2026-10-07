import type { UserRole } from "../../generated/prisma/client.js";

export type CraftOrderChatAccess = { readonly customerId: string };

export const canAccessCraftOrderChat = (
  role: UserRole,
  userId: string,
  order: CraftOrderChatAccess,
): boolean =>
  role === "ADMIN" || (role === "CUSTOMER" && order.customerId === userId);
