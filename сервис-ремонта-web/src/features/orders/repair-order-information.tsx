import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Phone } from "lucide-react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";

import { type RepairOrder, uploadRepairOrderPhoto } from "@/lib/api";

const statusLabels: Record<string, string> = {
  REQUESTED: "Новая",
  ASSIGNED: "Назначен мастер",
  IN_PROGRESS: "В ремонте",
  READY_FOR_PICKUP: "Готова к выдаче",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};

export const RepairOrderInformation = ({ order, token }: { order: RepairOrder; token: string }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => uploadRepairOrderPhoto(token, order.id, file),
    onSuccess: async () => {
      toast.success("Фото добавлено к заявке.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", token] }),
        queryClient.invalidateQueries({ queryKey: ["order-search", token] }),
        queryClient.invalidateQueries({ queryKey: ["admin-order-search", token] }),
        queryClient.invalidateQueries({ queryKey: ["admin-repair-order", token, order.id] }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось добавить фотографию."),
  });
  const address = [
    order.city,
    order.street,
    order.house && `д. ${order.house}`,
    order.apartment && `кв. ${order.apartment}`,
    order.entrance && `подъезд ${order.entrance}`,
    order.floor && `этаж ${order.floor}`,
  ]
    .filter(Boolean)
    .join(", ");
  const canAddPhoto = !["READY_FOR_PICKUP", "COMPLETED", "CANCELLED"].includes(order.status);

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) upload.mutate(file);
  };

  return (
    <section className="mt-3 grid gap-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div>
        <h4 className="text-sm font-semibold">Информация о заявке</h4>
        <dl className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          {(order.deviceBrand || order.deviceModel || order.deviceSerialNumber) && (
            <div>
              <dt className="text-slate-500">Техника</dt>
              <dd>
                {[order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") ||
                  "Модель не указана"}
                {order.deviceSerialNumber && ` · серийный № ${order.deviceSerialNumber}`}
              </dd>
            </div>
          )}
          {order.preferredAt && (
            <div>
              <dt className="text-slate-500">Желаемое время</dt>
              <dd>{new Date(order.preferredAt).toLocaleString("ru-RU")}</dd>
            </div>
          )}
          {order.repairLocation && (
            <div>
              <dt className="text-slate-500">Место ремонта</dt>
              <dd>
                {order.repairLocation === "SERVICE_CENTER" ? "В сервисном центре" : "У клиента"}
              </dd>
            </div>
          )}
          {(order.visitScenarioVersion ?? 0) > 0 && (
            <>
              <div>
                <dt className="text-slate-500">Диагностика</dt>
                <dd>
                  {order.diagnosisCompletedAt
                    ? `Проведена · ${(order.diagnosisFeeRub ?? 850).toLocaleString("ru-RU")} ₽`
                    : "850 ₽, только если мастер её проведёт"}
                </dd>
              </div>
              {order.repairLocation === "CUSTOMER_ADDRESS" && (
                <div>
                  <dt className="text-slate-500">Выезд от границы Пушкино</dt>
                  <dd>
                    {order.visitIsWithinCity
                      ? "В пределах города · бесплатно"
                      : order.visitVerifiedDistanceKm != null
                        ? `${order.visitVerifiedDistanceKm} км в одну сторону · ${(
                            order.visitFeeRub ?? 0
                          ).toLocaleString(
                            "ru-RU",
                          )} ₽${order.visitDistanceVerifiedAt ? " · проверено по Яндекс Картам" : ""}`
                        : `${order.visitCustomerDistanceKm ?? "Расстояние не указано"} км ориентировочно · проверит мастер или администратор`}
                  </dd>
                </div>
              )}
              {(order.visitFeeRub ?? 0) > 0 && (
                <div>
                  <dt className="text-slate-500">Плата за выезд</dt>
                  <dd>{order.visitFeeRub?.toLocaleString("ru-RU")} ₽ · в одну сторону, мастеру</dd>
                </div>
              )}
            </>
          )}
          <div>
            <dt className="text-slate-500">Контактный адрес клиента</dt>
            <dd>{address || order.address || "Не указан"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Телефон для связи</dt>
            <dd>{order.contactPhone ?? "Не указан"}</dd>
          </div>
          {order.additionalPhone && (
            <div>
              <dt className="text-slate-500">Дополнительный телефон</dt>
              <dd>{order.additionalPhone}</dd>
            </div>
          )}
          {order.hasBarrier && (
            <div>
              <dt className="text-slate-500">Доступ</dt>
              <dd>На территории установлен шлагбаум</dd>
            </div>
          )}
          {order.additionalInfo && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Дополнительная информация</dt>
              <dd className="whitespace-pre-wrap">{order.additionalInfo}</dd>
            </div>
          )}
        </dl>
        {(user?.role !== "CUSTOMER" || order.assignedTechnician) && (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            {user?.role !== "CUSTOMER" && order.customer && (
              <p>
                Клиент: <strong>{order.customer.displayName}</strong>
                {order.customer.phoneNumber && ` · ${order.customer.phoneNumber}`}
              </p>
            )}
            {order.assignedTechnician && (
              <p className="flex flex-wrap items-center gap-1">
                Мастер: <strong>{order.assignedTechnician.displayName}</strong>
                {user?.role === "CUSTOMER" && (
                  <Link
                    to="/staff/$technicianId"
                    params={{ technicianId: order.assignedTechnician.id }}
                    className="ml-1 font-semibold text-blue-600 hover:underline"
                  >
                    Профиль мастера
                  </Link>
                )}
                {order.assignedTechnician.phoneNumber && (
                  <a
                    href={`tel:${order.assignedTechnician.phoneNumber}`}
                    className="ml-1 inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Phone size={13} aria-hidden="true" />
                    {order.assignedTechnician.phoneNumber}
                  </a>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Фотографии заявки</h4>
          {canAddPhoto ? (
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700">
              <ImagePlus size={14} aria-hidden="true" />
              {upload.isPending ? "Загружаем…" : "Добавить фото"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={selectPhoto}
                disabled={upload.isPending}
              />
            </label>
          ) : (
            <span className="text-xs text-slate-500">Добавление закрыто на этом этапе</span>
          )}
        </div>
        {(order.photos?.length ?? 0) ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {order.photos?.map((photo, index) => (
              <figure key={photo.id}>
                <ProtectedImage
                  objectId={photo.objectId}
                  alt={`Фото ${index + 1} к заявке ${order.serviceNumber}`}
                  className="aspect-video w-full rounded-lg object-cover"
                />
                {photo.createdBy && (
                  <figcaption className="mt-1 text-[11px] text-slate-500">
                    Добавил(а): {photo.createdBy.displayName}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Фотографий пока нет.</p>
        )}
      </div>

      {!!order.statusEvents?.length && (
        <div>
          <h4 className="text-sm font-semibold">История статусов</h4>
          <ol className="mt-2 grid gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
            {order.statusEvents.map((event, index) => (
              <li key={`${event.createdAt}-${index}`} className="text-xs">
                <p className="font-medium">
                  {event.from ? `${statusLabels[event.from] ?? event.from} → ` : ""}
                  {statusLabels[event.to] ?? event.to}
                </p>
                <p className="mt-0.5 text-slate-500">
                  {new Date(event.createdAt).toLocaleString("ru-RU")}
                  {event.actor?.displayName ? ` · ${event.actor.displayName}` : ""}
                </p>
                {event.note && (
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{event.note}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};
