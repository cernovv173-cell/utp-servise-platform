import type { UserRole } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http/http-error.js";
import type { AuthenticatedUser } from "./auth.middleware.js";

export const STAFF_PERMISSION_OPTIONS = [
  {
    key: "repairs",
    label: "Заявки и ремонт",
    description: "Назначенные заявки, этапы ремонта и собственные начисления.",
  },
  {
    key: "inventory",
    label: "Каталог и склад",
    description: "Каталог товаров и запчастей, остатки, поставщики и приёмка.",
  },
  {
    key: "customers",
    label: "Клиенты",
    description: "Поиск клиентов и работа с их контактными данными.",
  },
  {
    key: "shop_orders",
    label: "Заказы магазина",
    description: "Обработка заказов товаров и согласование доставки.",
  },
  {
    key: "communications",
    label: "Чаты и поддержка",
    description: "Ответы в чатах по заявкам и обращениям клиентов.",
  },
  {
    key: "content",
    label: "Новости и предложения",
    description: "Новости, баннеры, акции и розыгрыши.",
  },
  {
    key: "reports",
    label: "Расписание и отчёты",
    description: "Просмотр расписания, сводок и рабочих отчётов.",
  },
  {
    key: "company_settings",
    label: "Настройки сервиса",
    description: "Контакты компании и сезонное оформление сайта и приложения.",
  },
  {
    key: "staff_management",
    label: "Сотрудники и доступы",
    description:
      "Создание сотрудников и настройка их прав. Полный доступ администратора выдаётся отдельно.",
  },
] as const;

export type StaffPermission = (typeof STAFF_PERMISSION_OPTIONS)[number]["key"];

export const STAFF_ASSIGNABLE_PERMISSION_OPTIONS =
  STAFF_PERMISSION_OPTIONS.filter(
    (option) => option.key !== "staff_management",
  );

export const STAFF_PERMISSION_KEYS = STAFF_PERMISSION_OPTIONS.map(
  ({ key }) => key,
) as [StaffPermission, ...StaffPermission[]];

export const STAFF_ASSIGNABLE_PERMISSION_KEYS =
  STAFF_ASSIGNABLE_PERMISSION_OPTIONS.map(({ key }) => key) as [
    StaffPermission,
    ...StaffPermission[],
  ];

const allStaffPermissions = STAFF_PERMISSION_KEYS;

const isFullAdministrator = (
  user: Pick<AuthenticatedUser, "role" | "isAdminAssistant">,
) => user.role === "ADMIN" && !user.isAdminAssistant;

const legacyPermissionsForRole = (
  role: UserRole,
  isAdminAssistant: boolean,
) => {
  if (role === "ADMIN" && isAdminAssistant) return allStaffPermissions;
  if (role === "ADMIN") return allStaffPermissions;
  if (role === "TECHNICIAN") return ["repairs"] as const;
  if (role === "PROCUREMENT") return ["inventory"] as const;
  return [] as const;
};

export const permissionsForUser = (
  user: Pick<
    AuthenticatedUser,
    | "role"
    | "isAdminAssistant"
    | "staffPermissions"
    | "staffPermissionsConfigured"
  >,
): readonly StaffPermission[] => {
  if (isFullAdministrator(user)) return allStaffPermissions;
  if (user.staffPermissionsConfigured) {
    return (user.staffPermissions ?? []).filter(
      (permission): permission is StaffPermission =>
        (STAFF_PERMISSION_KEYS as readonly string[]).includes(permission),
    );
  }
  return legacyPermissionsForRole(user.role, Boolean(user.isAdminAssistant));
};

export const hasStaffPermission = (
  user: Parameters<typeof permissionsForUser>[0],
  permission: StaffPermission,
): boolean => permissionsForUser(user).includes(permission);

export const isFullAdmin = isFullAdministrator;

export const publicRoleForUser = (user: {
  readonly role: UserRole;
  readonly staffPermissionsConfigured?: boolean;
}): UserRole | "STAFF" =>
  user.staffPermissionsConfigured && user.role !== "ADMIN"
    ? "STAFF"
    : user.role;

export const assertCanAssignPermissions = (
  actor: Parameters<typeof permissionsForUser>[0],
  requested: readonly StaffPermission[],
) => {
  if (isFullAdministrator(actor)) return;
  const actorPermissions = new Set(permissionsForUser(actor));
  if (requested.some((permission) => !actorPermissions.has(permission))) {
    throw new HttpError(
      403,
      "STAFF_PERMISSION_ESCALATION_FORBIDDEN",
      "Нельзя выдавать права, которыми вы сами не обладаете.",
    );
  }
};
