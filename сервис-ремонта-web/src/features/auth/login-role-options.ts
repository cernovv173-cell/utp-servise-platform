import type { LoginPortal } from "@/lib/api";

export const loginPortalOptions: readonly {
  readonly value: LoginPortal;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: "CUSTOMER",
    label: "Клиент",
    description: "Заявки, ремонт и магазин",
  },
  {
    value: "STAFF",
    label: "Сотрудник",
    description: "Мастер, закупки или администратор — система определит вашу роль после входа.",
  },
];
