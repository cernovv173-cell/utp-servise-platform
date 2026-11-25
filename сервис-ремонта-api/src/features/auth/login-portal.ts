import { z } from "zod";

export const loginPortalValues = [
  "CUSTOMER",
  "STAFF",
  "TECHNICIAN",
  "ADMIN",
  "PROCUREMENT",
] as const;

export const loginPortalSchema = z.enum(loginPortalValues);

export type LoginPortal = (typeof loginPortalValues)[number];

const staffAccountRoles = ["TECHNICIAN", "ADMIN", "PROCUREMENT"] as const;

export const isStaffAccountRole = (role: string): boolean =>
  (staffAccountRoles as readonly string[]).includes(role);

export const matchesLoginPortal = (
  portal: LoginPortal,
  accountRole: string,
): boolean =>
  portal === "STAFF" ? isStaffAccountRole(accountRole) : accountRole === portal;
