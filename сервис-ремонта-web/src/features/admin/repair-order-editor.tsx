import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Select } from "@/components/select";

import { RepairOrderItemsEditor } from "@/features/admin/repair-order-items-editor";
import { repairDeviceTypeLabels, repairDeviceTypes } from "@/features/catalog/catalog-model";

import { type RepairCatalogItem, type RepairOrder, updateRepairOrder } from "@/lib/api";

const localDateTimeValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const RepairOrderEditor = ({
  order,
  token,
  catalogItems,
  isCatalogLoading,
  isCatalogError,
  isEditing: controlledIsEditing,
  onEditingChange,
  allowItemEditing = true,
  showItemEditHint = true,
  showEditToggle = true,
  onRefresh,
}: {
  order: RepairOrder;
  token: string;
  catalogItems: RepairCatalogItem[];
  isCatalogLoading: boolean;
  isCatalogError: boolean;
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  allowItemEditing?: boolean;
  showItemEditHint?: boolean;
  showEditToggle?: boolean;
  onRefresh: () => Promise<unknown>;
}) => {
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const isEditing = controlledIsEditing ?? localIsEditing;
  const setIsEditing = (next: boolean) => {
    if (controlledIsEditing === undefined) setLocalIsEditing(next);
    onEditingChange?.(next);
  };
  const [deviceType, setDeviceType] = useState(order.deviceType);
  const deviceTypeOptions = [
    ...repairDeviceTypes.map((value) => ({
      value,
      label: repairDeviceTypeLabels[value],
    })),
    ...(repairDeviceTypes.includes(order.deviceType as (typeof repairDeviceTypes)[number])
      ? []
      : [
          {
            value: order.deviceType,
            label: repairDeviceTypeLabels[order.deviceType] ?? order.deviceType,
          },
        ]),
  ];
  const canEditItems =
    allowItemEditing &&
    !order.estimates?.length &&
    isEditing &&
    order.status !== "COMPLETED" &&
    order.status !== "CANCELLED" &&
    order.receipt?.paymentStatus !== "PAID";

  const editMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateRepairOrder>[2]) =>
      updateRepairOrder(token, order.id, input),
    onSuccess: async () => {
      await onRefresh();
      setIsEditing(false);
      toast.success("Заявка на ремонт обновлена.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить заявку."),
  });

  const saveRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const preferredAt = String(form.get("preferredAt") || "");
    editMutation.mutate({
      deviceType,
      deviceBrand: String(form.get("deviceBrand") || ""),
      deviceModel: String(form.get("deviceModel") || ""),
      deviceSerialNumber: String(form.get("deviceSerialNumber") || ""),
      problem: String(form.get("problem")),
      contactPhone: String(form.get("contactPhone")),
      city: String(form.get("city")),
      street: String(form.get("street")),
      house: String(form.get("house")),
      apartment: String(form.get("apartment") || ""),
      entrance: String(form.get("entrance") || ""),
      hasBarrier: form.get("hasBarrier") === "on",
      floor: String(form.get("floor") || ""),
      additionalPhone: String(form.get("additionalPhone") || ""),
      additionalInfo: String(form.get("additionalInfo") || ""),
      preferredAt: preferredAt ? new Date(preferredAt).toISOString() : null,
    });
  };

  return (
    <div className="mt-3 grid gap-3">
      {(showEditToggle || isEditing) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <div>
            <h4 className="text-sm font-semibold">Данные заявки</h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Тип устройства, неисправность и контактная информация клиента.
            </p>
          </div>
          {showEditToggle && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              aria-expanded={isEditing}
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {isEditing ? "Закрыть редактирование" : "Редактировать заказ"}
            </button>
          )}
        </div>
      )}

      <RepairOrderItemsEditor
        order={order}
        token={token}
        catalogItems={catalogItems}
        canEdit={canEditItems}
        showEditHint={showItemEditHint}
        isCatalogLoading={isCatalogLoading}
        isCatalogError={isCatalogError}
        onRefresh={onRefresh}
      />

      {isEditing && (
        <form
          onSubmit={saveRequest}
          className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-900"
        >
          <label className="grid gap-1 text-xs font-medium">
            Устройство
            <Select
              ariaLabel="Тип устройства"
              value={deviceType}
              onValueChange={setDeviceType}
              options={deviceTypeOptions}
              className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Марка
            <input
              name="deviceBrand"
              maxLength={120}
              defaultValue={order.deviceBrand ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Модель
            <input
              name="deviceModel"
              maxLength={160}
              defaultValue={order.deviceModel ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Серийный номер
            <input
              name="deviceSerialNumber"
              maxLength={160}
              defaultValue={order.deviceSerialNumber ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Удобное время
            <input
              name="preferredAt"
              type="datetime-local"
              defaultValue={localDateTimeValue(order.preferredAt)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2 lg:col-span-3">
            Описание неисправности
            <textarea
              name="problem"
              required
              minLength={5}
              maxLength={2000}
              defaultValue={order.problem}
              rows={3}
              className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Телефон клиента
            <input
              name="contactPhone"
              required
              minLength={7}
              maxLength={32}
              defaultValue={order.contactPhone ?? order.customer?.phoneNumber ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Город
            <input
              name="city"
              required
              minLength={2}
              maxLength={120}
              defaultValue={order.city ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Улица
            <input
              name="street"
              required
              minLength={2}
              maxLength={180}
              defaultValue={order.street ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Дом
            <input
              name="house"
              required
              maxLength={30}
              defaultValue={order.house ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Квартира
            <input
              name="apartment"
              maxLength={30}
              defaultValue={order.apartment ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Подъезд
            <input
              name="entrance"
              maxLength={30}
              defaultValue={order.entrance ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Этаж
            <input
              name="floor"
              maxLength={20}
              defaultValue={order.floor ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Дополнительный телефон
            <input
              name="additionalPhone"
              maxLength={32}
              defaultValue={order.additionalPhone ?? ""}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              name="hasBarrier"
              defaultChecked={order.hasBarrier}
              className="size-4 accent-blue-600"
            />
            Есть шлагбаум
          </label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2 lg:col-span-3">
            Дополнительная информация
            <textarea
              name="additionalInfo"
              maxLength={500}
              defaultValue={order.additionalInfo ?? ""}
              rows={2}
              className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled={editMutation.isPending}
            className="min-h-9 justify-self-start rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {editMutation.isPending ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </form>
      )}
    </div>
  );
};
