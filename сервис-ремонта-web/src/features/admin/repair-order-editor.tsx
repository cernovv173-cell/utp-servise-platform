import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Select } from "@/components/select";

import {
  type RepairCatalogItem,
  type RepairOrder,
  addRepairOrderItem,
  updateRepairOrder,
} from "@/lib/api";

export const RepairOrderEditor = ({
  order,
  token,
  catalogItems,
  isCatalogLoading,
  isCatalogError,
  onRefresh,
}: {
  order: RepairOrder;
  token: string;
  catalogItems: RepairCatalogItem[];
  isCatalogLoading: boolean;
  isCatalogError: boolean;
  onRefresh: () => Promise<unknown>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [deviceType, setDeviceType] = useState(order.deviceType);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const canAddService =
    order.status !== "COMPLETED" &&
    order.status !== "CANCELLED" &&
    order.receipt?.paymentStatus !== "PAID";
  const services = catalogItems.filter((item) => item.active && item.type === "SERVICE");

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

  const itemMutation = useMutation({
    mutationFn: ({ id, count }: { id: string; count: number }) =>
      addRepairOrderItem(token, order.id, id, count),
    onSuccess: async () => {
      await onRefresh();
      setCatalogItemId("");
      setQuantity("1");
      toast.success("Услуга добавлена в заявку.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось добавить услугу."),
  });

  const saveRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    editMutation.mutate({
      deviceType,
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
    });
  };

  const addService = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = Number(quantity);
    if (!catalogItemId || !Number.isInteger(count) || count < 1 || count > 99) {
      toast.error("Выберите услугу и укажите количество от 1 до 99.");
      return;
    }
    itemMutation.mutate({ id: catalogItemId, count });
  };

  return (
    <div className="mt-3 grid gap-3">
      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <h4 className="text-sm font-semibold">Услуги и позиции заявки</h4>
        {order.items.length > 0 ? (
          <div className="mt-2 grid gap-2">
            {order.items.map((item) => (
              <div className="flex flex-wrap justify-between gap-2 text-xs" key={item.id}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{(item.unitPriceRub * item.quantity).toLocaleString("ru-RU")} ₽</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">В заявке пока нет услуг или запчастей.</p>
        )}
        {canAddService && (
          <form
            onSubmit={addService}
            className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"
          >
            <Select
              ariaLabel="Услуга из каталога"
              value={catalogItemId}
              onValueChange={setCatalogItemId}
              placeholder="Выберите услугу"
              options={services.map((service) => ({
                value: service.id,
                label: `${service.name} · ${service.unitPriceRub.toLocaleString("ru-RU")} ₽`,
              }))}
              className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <label className="sr-only" htmlFor={`service-quantity-${order.id}`}>
              Количество услуги
            </label>
            <input
              id={`service-quantity-${order.id}`}
              aria-label="Количество услуги"
              type="number"
              min={1}
              max={99}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={itemMutation.isPending || services.length === 0}
              className="min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Добавить услугу
            </button>
            {services.length === 0 && isCatalogLoading && (
              <p className="text-xs text-slate-500 sm:col-span-3">Загружаем каталог услуг…</p>
            )}
            {services.length === 0 && isCatalogError && (
              <p role="alert" className="text-xs text-rose-600 sm:col-span-3">
                Не удалось загрузить каталог услуг. Обновите страницу и попробуйте снова.
              </p>
            )}
            {services.length === 0 && !isCatalogLoading && !isCatalogError && (
              <p className="text-xs text-slate-500 sm:col-span-3">
                В активном каталоге нет услуг. Добавьте услугу в разделе «Каталог».
              </p>
            )}
          </form>
        )}
      </section>

      <div>
        <button
          type="button"
          onClick={() => setIsEditing((value) => !value)}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700"
        >
          {isEditing ? "Скрыть редактирование" : "Редактировать заявку"}
        </button>
      </div>

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
              options={[
                { value: "COMPUTER", label: "Компьютер" },
                { value: "LAPTOP", label: "Ноутбук" },
                { value: "PHONE", label: "Телефон" },
                { value: "TABLET", label: "Планшет" },
              ]}
              className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
