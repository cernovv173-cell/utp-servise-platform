import type { StaffPermission, User } from "@/lib/api";

type PermissionSubject = {
  role: string;
  permissions?: readonly StaffPermission[] | null;
  isAdminAssistant?: boolean;
};

const allStaffPermissions: readonly StaffPermission[] = [
  "repairs",
  "inventory",
  "customers",
  "shop_orders",
  "communications",
  "content",
  "reports",
  "company_settings",
  "staff_management",
];

export const hasPermission = <T extends PermissionSubject>(
  user: T | null | undefined,
  permission: StaffPermission,
): user is T => {
  if (!user || user.role === "CUSTOMER") return false;
  if (user.role === "ADMIN" && !user.isAdminAssistant)
    return allStaffPermissions.includes(permission);
  if (user.permissions) return user.permissions.includes(permission);
  if (user.role === "ADMIN") return allStaffPermissions.includes(permission);
  if (user.role === "TECHNICIAN") return permission === "repairs";
  if (user.role === "PROCUREMENT") return permission === "inventory";
  return false;
};

export const hasAnyPermission = <T extends PermissionSubject>(
  user: T | null | undefined,
  permissions: readonly StaffPermission[],
): user is T => permissions.some((permission) => hasPermission(user, permission));

export const isFullAdministrator = (user: User | null | undefined): boolean =>
  user?.role === "ADMIN" && !user.isAdminAssistant;
