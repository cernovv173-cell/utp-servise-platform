import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { repairDeviceTypes } from "@/features/catalog/catalog-model";

import {
  createCustomerDevice,
  createWarrantyClaim,
  deleteCustomerDevice,
  getCustomerDevices,
  updateCustomerDevice,
} from "@/lib/api";

const deviceLabels: Record<string, string> = {
  COMPUTER: "ПК",
  LAPTOP: "Ноутбук",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

const statusLabels: Record<string, string> = {
  REQUESTED: "Заявка принята",
  ASSIGNED: "Мастер назначен",
  IN_PROGRESS: "В ремонте",
  READY_FOR_PICKUP: "Готово к выдаче",
  COMPLETED: "Ремонт завершён",
  CANCELLED: "Отменено",
};

const localMoscowDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const DevicePage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate({ from: "/devices" });
  const queryClient = useQueryClient();
  const [deviceType, setDeviceType] = useState("COMPUTER");
  const [nickname, setNickname] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [nextMaintenanceAt, setNextMaintenanceAt] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [claimOrderId, setClaimOrderId] = useState<string | null>(null);
  const [claimProblem, setClaimProblem] = useState("");
  const devicesQuery = useQuery({
    queryKey: ["customer-devices", token],
    queryFn: ({ signal }) => getCustomerDevices(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });
  const refreshDevices = () =>
    queryClient.invalidateQueries({ queryKey: ["customer-devices", token] });
  const createMutation = useMutation({
    mutationFn: () =>
      createCustomerDevice(token!, {
        deviceType,
        nickname: nickname.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        nextMaintenanceAt: nextMaintenanceAt || null,
        maintenanceNote: maintenanceNote.trim() || null,
      }),
    onSuccess: async () => {
      setNickname("");
      setBrand("");
      setModel("");
      setSerialNumber("");
      setNextMaintenanceAt("");
      setMaintenanceNote("");
      await refreshDevices();
      toast.success("Техника добавлена");
    },
  });
  const reminderMutation = useMutation({
    mutationFn: ({
      deviceId,
      date,
      note,
    }: {
      deviceId: string;
      date: string | null;
      note: string | null;
    }) =>
      updateCustomerDevice(token!, deviceId, { nextMaintenanceAt: date, maintenanceNote: note }),
    onSuccess: async () => {
      await refreshDevices();
      toast.success("Напоминание сохранено");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (deviceId: string) => deleteCustomerDevice(token!, deviceId),
    onSuccess: async () => {
      await refreshDevices();
      toast.success("Техника удалена из списка; история заявок сохранена");
    },
  });
  const warrantyClaimMutation = useMutation({
    mutationFn: () => createWarrantyClaim(token!, claimOrderId!, claimProblem.trim()),
    onSuccess: async ({ order }) => {
      setClaimOrderId(null);
      setClaimProblem("");
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });
      toast.success("Гарантийное обращение создано");
      await navigate({ to: "/chats", search: { orderId: order.id } });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Не удалось отправить обращение по гарантии.",
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate();
  };

  return (
    <AppShell active="/devices">
      <PageTitle
        eyebrow="МОЯ ТЕХНИКА"
        title="Устройства и обслуживание"
        description="Сохраните технику, чтобы повторно вызвать мастера без повторного ввода модели и серийного номера."
      />
      {user?.role !== "CUSTOMER" ? (
        <SectionCard>Список личной техники доступен клиентам сервиса.</SectionCard>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SectionCard>
            <h2 className="font-semibold">Добавить устройство</h2>
            <form onSubmit={submit} className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Тип устройства&nbsp;*
                <select
                  required
                  value={deviceType}
                  onChange={(event) => setDeviceType(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
                >
                  {repairDeviceTypes.map((value) => (
                    <option key={value} value={value}>
                      {deviceLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              {[
                [
                  "nickname",
                  "Название для себя",
                  nickname,
                  setNickname,
                  "Например, рабочий ноутбук",
                ],
                ["brand", "Марка", brand, setBrand, "Например, Lenovo"],
                ["model", "Модель", model, setModel, "Например, ThinkPad T14"],
                ["serial", "Серийный номер", serialNumber, setSerialNumber, "Если известен"],
              ].map(([key, label, value, setter, placeholder]) => (
                <label key={String(key)} className="grid gap-1.5 text-sm font-medium">
                  {String(label)}
                  <input
                    value={String(value)}
                    onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                    placeholder={String(placeholder)}
                    maxLength={String(key) === "model" || String(key) === "serial" ? 160 : 120}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              ))}
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                <p className="font-semibold">Напомнить об обслуживании</p>
                <label className="mt-2 grid gap-1.5 text-xs font-medium">
                  Дата
                  <input
                    type="date"
                    min={localMoscowDate()}
                    value={nextMaintenanceAt}
                    onChange={(event) => setNextMaintenanceAt(event.target.value)}
                    className="h-10 rounded-lg border border-blue-200 bg-white px-3 font-normal dark:border-blue-900 dark:bg-slate-900"
                  />
                </label>
                <label className="mt-2 grid gap-1.5 text-xs font-medium">
                  Что проверить
                  <input
                    value={maintenanceNote}
                    onChange={(event) => setMaintenanceNote(event.target.value)}
                    maxLength={250}
                    placeholder="Например, профилактическая чистка"
                    className="h-10 rounded-lg border border-blue-200 bg-white px-3 font-normal dark:border-blue-900 dark:bg-slate-900"
                  />
                </label>
                <p className="mt-2 text-xs leading-5 text-blue-800/80 dark:text-blue-200/80">
                  В день обслуживания появится напоминание в приложении и push-уведомление, если на
                  телефоне включены уведомления.
                </p>
              </div>
              <button
                disabled={createMutation.isPending}
                className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createMutation.isPending ? "Сохраняем…" : "Добавить технику"}
              </button>
              {createMutation.isError && (
                <p role="alert" className="text-sm text-rose-600">
                  Не удалось сохранить устройство. Проверьте данные и повторите.
                </p>
              )}
            </form>
          </SectionCard>

          <div className="grid content-start gap-4">
            {devicesQuery.isLoading && <p className="text-sm text-slate-500">Загружаем список…</p>}
            {devicesQuery.isError && (
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить технику.
              </p>
            )}
            {(devicesQuery.data?.devices ?? []).map((device) => {
              const dueDate = device.nextMaintenanceAt?.slice(0, 10) ?? "";
              const isDue = Boolean(dueDate && dueDate <= localMoscowDate());
              return (
                <SectionCard key={device.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
                        {deviceLabels[device.deviceType] ?? device.deviceType}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold">
                        {device.nickname ||
                          [device.brand, device.model].filter(Boolean).join(" ") ||
                          "Без названия"}
                      </h2>
                      {(device.brand || device.model || device.serialNumber) && (
                        <p className="mt-1 text-sm text-slate-500">
                          {[
                            device.brand,
                            device.model,
                            device.serialNumber && `сер. № ${device.serialNumber}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Удалить технику из списка? Существующие заявки и документы сохранятся.",
                          )
                        ) {
                          deleteMutation.mutate(device.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Удалить
                    </button>
                  </div>
                  <div
                    className={`mt-4 rounded-xl p-3 ${isDue ? "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                  >
                    <p className="text-sm font-semibold">
                      {dueDate
                        ? `${isDue ? "Пора обслужить" : "Напоминание"} · ${new Date(`${dueDate}T12:00:00`).toLocaleDateString("ru-RU")}`
                        : "Напоминание об обслуживании не задано"}
                    </p>
                    {device.maintenanceNote && (
                      <p className="mt-1 text-xs">{device.maintenanceNote}</p>
                    )}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        reminderMutation.mutate({
                          deviceId: device.id,
                          date: String(data.get("date") || "") || null,
                          note: String(data.get("note") || "").trim() || null,
                        });
                      }}
                      className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <label className="grid gap-1 text-xs font-medium">
                        Дата обслуживания
                        <input
                          name="date"
                          type="date"
                          min={localMoscowDate()}
                          defaultValue={dueDate}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 font-normal dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium">
                        Примечание
                        <input
                          name="note"
                          maxLength={250}
                          defaultValue={device.maintenanceNote ?? ""}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 font-normal dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <button
                        disabled={reminderMutation.isPending}
                        className="mt-auto min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-slate-700"
                      >
                        Сохранить
                      </button>
                    </form>
                  </div>
                  {(device.deviceType === "COMPUTER" || device.deviceType === "LAPTOP") && (
                    <Link
                      to="/orders"
                      search={{ device: device.id }}
                      className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Повторить заявку
                    </Link>
                  )}
                  <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <h3 className="text-sm font-semibold">История ремонта</h3>
                    {device.repairOrders?.length ? (
                      <ul className="mt-2 grid gap-2">
                        {device.repairOrders.map((order) => (
                          <li
                            key={order.id}
                            className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"
                          >
                            <Link
                              to="/orders"
                              className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                            >
                              {order.serviceNumber}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">
                              {statusLabels[order.status] ?? order.status} ·{" "}
                              {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                            </p>
                            <p className="mt-1 text-xs">{order.problem}</p>
                            {order.receipt && (
                              <p className="mt-1 text-xs text-slate-500">
                                Чек {order.receipt.receiptNumber}
                              </p>
                            )}
                            {order.warranty && (
                              <div className="mt-1 grid gap-2 text-xs">
                                <p className="text-slate-500">
                                  Гарантия {order.warranty.warrantyNumber} до{" "}
                                  {new Date(order.warranty.expiresAt).toLocaleDateString("ru-RU")}
                                </p>
                                {order.warrantyOriginOrder && (
                                  <p className="text-amber-700 dark:text-amber-300">
                                    Гарантийное обращение по ремонту{" "}
                                    {order.warrantyOriginOrder.serviceNumber}
                                  </p>
                                )}
                                {new Date(order.warranty.expiresAt).getTime() > Date.now() &&
                                  !order.warrantyOriginOrder && (
                                    <>
                                      {claimOrderId === order.id ? (
                                        <form
                                          className="grid gap-2 rounded-lg border border-blue-200 p-3 dark:border-blue-900"
                                          onSubmit={(event) => {
                                            event.preventDefault();
                                            warrantyClaimMutation.mutate();
                                          }}
                                        >
                                          <label className="grid gap-1 text-slate-700 dark:text-slate-200">
                                            Что снова неисправно?
                                            <textarea
                                              required
                                              minLength={5}
                                              maxLength={1800}
                                              value={claimProblem}
                                              onChange={(event) =>
                                                setClaimProblem(event.target.value)
                                              }
                                              className="min-h-20 rounded-lg border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                          </label>
                                          <p className="text-slate-500">
                                            Сервис проверит связь неисправности с выполненным
                                            ремонтом. Создание обращения не означает автоматического
                                            признания случая гарантийным; если работы окажутся вне
                                            гарантии, администратор подтвердит смету, а сервис
                                            сообщит стоимость до начала платных работ.
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              type="submit"
                                              disabled={
                                                warrantyClaimMutation.isPending ||
                                                claimProblem.trim().length < 5
                                              }
                                              className="min-h-9 rounded-lg bg-blue-600 px-3 font-semibold text-white disabled:opacity-50"
                                            >
                                              {warrantyClaimMutation.isPending
                                                ? "Отправляем…"
                                                : "Отправить обращение"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setClaimOrderId(null);
                                                setClaimProblem("");
                                              }}
                                              className="min-h-9 rounded-lg border border-slate-200 px-3 dark:border-slate-700"
                                            >
                                              Отмена
                                            </button>
                                          </div>
                                        </form>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setClaimOrderId(order.id)}
                                          className="min-h-9 justify-self-start rounded-lg border border-blue-200 px-3 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-slate-800"
                                        >
                                          Обратиться по гарантии
                                        </button>
                                      )}
                                    </>
                                  )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        Заявок для этой техники пока нет.
                      </p>
                    )}
                  </div>
                </SectionCard>
              );
            })}
            {!devicesQuery.isLoading &&
              !devicesQuery.isError &&
              !devicesQuery.data?.devices.length && (
                <SectionCard>
                  <p className="text-sm text-slate-500">
                    Добавьте устройство — оно сохранится в вашем кабинете для последующих заявок.
                  </p>
                </SectionCard>
              )}
          </div>
        </div>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/devices")({ component: DevicePage });
