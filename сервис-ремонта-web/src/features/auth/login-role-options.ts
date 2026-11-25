import type { Role } from "@/lib/api";

export type StaffLoginRole = Exclude<Role, "CUSTOMER">;

export const staffLoginRoleOptions: readonly {
  readonly label: string;
  readonly value: StaffLoginRole;
}[] = [
  { value: "TECHNICIAN", label: "Мастер" },
  { value: "PROCUREMENT", label: "Мастер закупки" },
  { value: "ADMIN", label: "Администратор Енот-сервис.рф" },
];

export const isStaffLoginRole = (value: string): value is StaffLoginRole =>
  staffLoginRoleOptions.some((option) => option.value === value);
