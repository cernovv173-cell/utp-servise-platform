import type { RequestHandler, Response } from "express";
import { createHash } from "node:crypto";

import type { UserRole } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  type StaffPermission,
  hasStaffPermission,
  permissionsForUser,
  publicRoleForUser,
} from "./staff-permissions.js";

export type AuthenticatedUser = {
  readonly id: string;
  readonly email: string | null;
  readonly login?: string | null;
  readonly displayName: string;
  readonly phoneNumber: string | null;
  readonly gender?: "MALE" | "FEMALE" | null;
  readonly birthDate?: Date | null;
  readonly telegramChatId?: string | null;
  readonly maxUserId?: string | null;
  readonly avatarObjectId: string | null;
  readonly role: UserRole;
  readonly isAdminAssistant?: boolean;
  readonly staffPermissions?: readonly string[];
  readonly staffPermissionsConfigured?: boolean;
  readonly salaryRatePercent?: number;
  readonly active: boolean;
  readonly terminatedAt?: Date | null;
  readonly mustChangePassword: boolean;
};

type AuthenticatedLocals = Response["locals"] & {
  authUser?: AuthenticatedUser;
};

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const createRequireAuth =
  (database: DatabaseClient): RequestHandler =>
  async (request, response, next) => {
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
    if (!match) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Войдите в аккаунт."));
      return;
    }

    const session = await database.session.findUnique({
      where: { tokenHash: hashToken(match[1]!) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            login: true,
            displayName: true,
            phoneNumber: true,
            gender: true,
            birthDate: true,
            telegramChatId: true,
            maxUserId: true,
            avatarObjectId: true,
            role: true,
            isAdminAssistant: true,
            staffPermissions: true,
            staffPermissionsConfigured: true,
            salaryRatePercent: true,
            active: true,
            terminatedAt: true,
            mustChangePassword: true,
          },
        },
      },
    });

    if (
      !session ||
      session.expiresAt <= new Date() ||
      !session.user.active ||
      session.user.terminatedAt
    ) {
      next(
        new HttpError(
          401,
          "SESSION_INVALID",
          "Сессия завершена. Войдите снова.",
        ),
      );
      return;
    }

    (response.locals as AuthenticatedLocals).authUser = session.user;
    next();
  };

export const requireRoles =
  (...roles: UserRole[]): RequestHandler =>
  (_request, response, next) => {
    const user = (response.locals as AuthenticatedLocals).authUser;
    if (!user) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Войдите в аккаунт."));
      return;
    }
    const hasRole = roles.some((role) => {
      if (role === "ADMIN") {
        return (
          user.role === "ADMIN" &&
          (!user.isAdminAssistant || !user.staffPermissionsConfigured)
        );
      }
      if (role === "TECHNICIAN") {
        return (
          user.role === "TECHNICIAN" && hasStaffPermission(user, "repairs")
        );
      }
      if (role === "PROCUREMENT") {
        return (
          user.role === "PROCUREMENT" && hasStaffPermission(user, "inventory")
        );
      }
      return user.role === role;
    });
    const canUseEmployeeRole =
      user.role !== "ADMIN" && user.role !== "CUSTOMER";
    const roleViaPermission =
      canUseEmployeeRole &&
      ((roles.includes("TECHNICIAN") && hasStaffPermission(user, "repairs")) ||
        (roles.includes("PROCUREMENT") &&
          hasStaffPermission(user, "inventory")));
    if (!hasRole && !roleViaPermission) {
      next(
        new HttpError(
          403,
          "FORBIDDEN",
          "Недостаточно прав для этого действия.",
        ),
      );
      return;
    }
    if (user.mustChangePassword) {
      next(
        new HttpError(
          403,
          "PASSWORD_CHANGE_REQUIRED",
          "Сначала смените временный пароль.",
        ),
      );
      return;
    }
    next();
  };

export const requireRolesOrStaffPermission =
  (
    permissions: StaffPermission | readonly StaffPermission[],
    ...roles: UserRole[]
  ): RequestHandler =>
  (_request, response, next) => {
    const user = (response.locals as AuthenticatedLocals).authUser;
    if (!user) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Войдите в аккаунт."));
      return;
    }
    const hasRole = roles.some((role) => {
      if (role === "ADMIN") {
        return (
          user.role === "ADMIN" &&
          (!user.isAdminAssistant || !user.staffPermissionsConfigured)
        );
      }
      if (role === "TECHNICIAN") {
        return (
          user.role === "TECHNICIAN" && hasStaffPermission(user, "repairs")
        );
      }
      if (role === "PROCUREMENT") {
        return (
          user.role === "PROCUREMENT" && hasStaffPermission(user, "inventory")
        );
      }
      return user.role === role;
    });
    const requiredPermissions = Array.isArray(permissions)
      ? permissions
      : [permissions];
    const canUseEmployeePermission =
      user.role !== "ADMIN" && user.role !== "CUSTOMER";
    if (
      !hasRole &&
      (!canUseEmployeePermission ||
        !requiredPermissions.some((permission) =>
          hasStaffPermission(user, permission),
        ))
    ) {
      next(
        new HttpError(
          403,
          "FORBIDDEN",
          "Недостаточно прав для этого действия.",
        ),
      );
      return;
    }
    if (user.mustChangePassword) {
      next(
        new HttpError(
          403,
          "PASSWORD_CHANGE_REQUIRED",
          "Сначала смените временный пароль.",
        ),
      );
      return;
    }
    next();
  };

export const requireStaffPermission =
  (...permissions: StaffPermission[]): RequestHandler =>
  (_request, response, next) => {
    const user = (response.locals as AuthenticatedLocals).authUser;
    if (!user) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Войдите в аккаунт."));
      return;
    }
    if (
      !permissions.some((permission) => hasStaffPermission(user, permission))
    ) {
      next(
        new HttpError(
          403,
          "FORBIDDEN",
          "Недостаточно прав для этого действия.",
        ),
      );
      return;
    }
    if (user.mustChangePassword) {
      next(
        new HttpError(
          403,
          "PASSWORD_CHANGE_REQUIRED",
          "Сначала смените временный пароль.",
        ),
      );
      return;
    }
    next();
  };

export const publicUser = (user: AuthenticatedUser) => ({
  id: user.id,
  email: user.email,
  login: user.login ?? null,
  displayName: user.displayName,
  phoneNumber: user.phoneNumber,
  gender: user.gender ?? null,
  birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
  avatarObjectId: user.avatarObjectId,
  role: publicRoleForUser(user),
  isAdminAssistant: Boolean(user.isAdminAssistant),
  permissions: permissionsForUser(user),
  mustChangePassword: user.mustChangePassword,
  telegramLinked: Boolean(user.telegramChatId),
  maxLinked: Boolean(user.maxUserId),
  maxAvailable: Boolean(
    process.env.MAX_BOT_TOKEN?.trim() && process.env.MAX_WEBHOOK_URL?.trim(),
  ),
});

export const getAuthenticatedUser = (response: Response): AuthenticatedUser => {
  const user = (response.locals as AuthenticatedLocals).authUser;
  if (!user)
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Войдите в аккаунт.");
  return user;
};

export const hashSessionToken = hashToken;
