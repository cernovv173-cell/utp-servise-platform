import { z } from "zod";

import type { UserRole } from "../../generated/prisma/client.js";

export const loginPortalValues = [
  "CUSTOMER",
  "STAFF",
  "TECHNICIAN",
  "ADMIN",
] as const;

export const loginPortalSchema = z.enum(loginPortalValues);

export type LoginPortal = (typeof loginPortalValues)[number];

const staffAccountRoles = ["TECHNICIAN", "PROCUREMENT", "ADMIN"] as const;

export const isStaffAccountRole = (role: string): boolean =>
  (staffAccountRoles as readonly string[]).includes(role);

export const matchesLoginPortal = (
  portal: LoginPortal | UserRole,
  accountRole: string,
): boolean => {
  if (portal === "PROCUREMENT") return false;
  return portal === "STAFF"
    ? isStaffAccountRole(accountRole)
    : accountRole === portal;
};
