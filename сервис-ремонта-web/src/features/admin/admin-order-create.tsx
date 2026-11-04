import { useQuery } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";

import { useAuth } from "@/features/auth/auth-context";

import {
  type AdminCustomer,
  type NewAdminCustomer,
  createAdminCustomer,
  createAdminOrder,
  getAdminCustomers,
} from "@/lib/api";

const fieldClassName =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950";

export const AdminOrderCreate = ({
  onCreated,
  trigger,
  triggerClassName,
}: {
  onCreated: () => void;
  trigger?: ReactNode;
  triggerClassName?: string;
}) => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [credentials, setCredentials] = useState<{
    login: string;
    password: string;
    orderCreated: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const candidates = useQuery({
    queryKey: ["admin-order-customers", token, customerSearch],
    queryFn: ({ signal }) => getAdminCustomers(token!, customerSearch.trim(), 1, 20, signal),
    enabled: Boolean(token && customerSearch.trim().length >= 2 && !customer),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!customer && customerMode === "existing") || !token) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get("contactPhone")).trim();
    const repairLocation =
      data.get("repairLocation") === "SERVICE_CENTER" ? "SERVICE_CENTER" : "CUSTOMER_ADDRESS";
    let newCustomer: NewAdminCustomer | null = null;
    setSaving(true);
    try {
      if (customerMode === "new") {
        newCustomer = await createAdminCustomer(token, {
          displayName: String(data.get("customerName")).trim(),
          email: String(data.get("customerEmail")).trim(),
          ...(phone ? { phoneNumber: phone } : {}),
        });
      }
      await createAdminOrder(token, {
        customerId: newCustomer?.customer.id ?? customer!.id,
        deviceType: String(data.get("deviceType")),
        repairLocation,
        problem: String(data.get("problem")).trim(),
        ...(phone ? { contactPhone: phone } : {}),
        city: String(data.get("city")).trim(),
        street: String(data.get("street")).trim(),
        house: String(data.get("house")).trim(),
        apartment: String(data.get("apartment")).trim(),
        additionalInfo: String(data.get("additionalInfo")).trim(),
      });
      toast.success("Заявка создана и добавлена в общий список.");
      if (newCustomer) {
        setCredentials({
          login: newCustomer.customer.email ?? "вход через МАКС",
          password: newCustomer.temporaryPassword,
          orderCreated: true,
        });
      }
      setOpen(false);
      setCustomer(null);
      setCustomerMode("existing");
      setCustomerSearch("");
      form.reset();
      onCreated();
    } catch {
      if (newCustomer) {
        setCredentials({
          login: newCustomer.customer.email ?? "вход через МАКС",
          password: newCustomer.temporaryPassword,
          orderCreated: false,
        });
        setOpen(false);
        toast.error("Учётная запись клиента создана, но заявка не отправлена.");
        onCreated();
      } else {
        toast.error("Не удалось создать заявку. Проверьте данные клиента и адрес.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        }
      >
        {trigger ?? "Создать заявку"}
      </button>
      <ModalContent className="max-w-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Новая заявка от имени сервиса</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            Заявка появится в общем списке, а её создание будет записано в истории.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                setCustomerMode("existing");
                setCustomer(null);
              }}
              className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${customerMode === "existing" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 dark:border-slate-700"}`}
            >
              Существующий клиент
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode("new");
                setCustomer(null);
              }}
              className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${customerMode === "new" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 dark:border-slate-700"}`}
            >
              Новый клиент
            </button>
          </div>
          {customerMode === "new" ? (
            <>
              <p className="text-xs text-slate-500 sm:col-span-2">
                Создадим клиентский вход с логином по электронной почте и временным паролем. При
                первом входе клиент должен будет сменить пароль.
              </p>
              <label className="grid gap-1 text-sm font-medium">
                Имя клиента{"\u00a0"}
                <span aria-hidden="true">*</span>
                <input
                  name="customerName"
                  required
                  minLength={2}
                  maxLength={120}
                  className={fieldClassName}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Электронная почта — логин{"\u00a0"}
                <span aria-hidden="true">*</span>
                <input
                  name="customerEmail"
                  type="email"
                  required
                  maxLength={320}
                  className={fieldClassName}
                />
              </label>
            </>
          ) : !customer ? (
            <div className="grid gap-2 sm:col-span-2">
              <label className="grid gap-1 text-sm font-medium">
                Найти активного клиента{"\u00a0"}
                <span aria-hidden="true">*</span>
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Введите имя, почту или телефон"
                  minLength={0}
                  maxLength={120}
                  className={fieldClassName}
                />
              </label>
              {customerSearch.trim().length < 2 ? (
                <p className="text-xs text-slate-500">Для поиска введите не менее двух символов.</p>
              ) : candidates.isLoading ? (
                <p className="text-xs text-slate-500">Ищем клиентов…</p>
              ) : (candidates.data?.customers.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">Активные клиенты не найдены.</p>
              ) : (
                <div className="grid max-h-40 gap-2 overflow-y-auto">
                  {candidates.data?.customers
                    .filter((entry) => entry.active)
                    .map((entry) => (
                      <button
                        type="button"
                        key={entry.id}
                        onClick={() => setCustomer(entry)}
                        className="rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-blue-500 dark:border-slate-700"
                      >
                        <span className="block font-semibold">{entry.displayName}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {entry.email || "вход через МАКС"} ·{" "}
                          {entry.phoneNumber || "телефон не указан"}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:col-span-2 dark:border-blue-900 dark:bg-blue-950/40">
              <div className="min-w-0">
                <p className="font-semibold">{customer.displayName}</p>
                <p className="truncate text-xs text-slate-500">
                  {customer.email || "вход через МАКС"} ·{" "}
                  {customer.phoneNumber || "телефон не указан"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
              >
                Выбрать другого
              </button>
            </div>
          )}
          <label className="grid gap-1 text-sm font-medium">
            Тип устройства{"\u00a0"}
            <span aria-hidden="true">*</span>
            <select name="deviceType" required className={fieldClassName}>
              <option value="COMPUTER">ПК</option>
              <option value="LAPTOP">Ноутбук</option>
              <option value="PHONE">Телефон</option>
              <option value="TABLET">Планшет</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <span>
              Телефон для связи
              {customerMode === "new" && (
                <>
                  &nbsp;<span aria-hidden="true">*</span>
                </>
              )}
            </span>
            <input
              name="contactPhone"
              defaultValue={customer?.phoneNumber ?? ""}
              type="tel"
              required={customerMode === "new"}
              minLength={7}
              maxLength={32}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Неисправность{"\u00a0"}
            <span aria-hidden="true">*</span>
            <textarea
              name="problem"
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="text-sm font-semibold">Место ремонта</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                <input
                  type="radio"
                  name="repairLocation"
                  value="CUSTOMER_ADDRESS"
                  required
                  defaultChecked
                  className="h-4 w-4 accent-blue-600"
                />
                У клиента
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                <input
                  type="radio"
                  name="repairLocation"
                  value="SERVICE_CENTER"
                  required
                  className="h-4 w-4 accent-blue-600"
                />
                В сервисном центре
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Выбор сохранится в заявке. Адрес ниже — контактный адрес клиента.
            </p>
          </fieldset>
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold">Контактный адрес клиента (необязательно)</p>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Город
            <input name="city" maxLength={120} className={fieldClassName} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Улица
            <input name="street" maxLength={180} className={fieldClassName} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Дом
            <input name="house" maxLength={30} className={fieldClassName} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Квартира
            <input name="apartment" maxLength={30} className={fieldClassName} />
          </label>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Дополнительная информация
            <textarea
              name="additionalInfo"
              maxLength={500}
              rows={2}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <ModalFooter className="sm:col-span-2">
            <ModalClose asChild>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
              >
                Отмена
              </button>
            </ModalClose>
            <button
              type="submit"
              disabled={saving || (customerMode === "existing" && !customer)}
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Создаём…" : "Создать заявку"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
      <Modal open={Boolean(credentials)} onOpenChange={(next) => !next && setCredentials(null)}>
        <ModalContent className="dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          <ModalHeader>
            <ModalTitle>Данные для первого входа</ModalTitle>
            <ModalDescription className="dark:text-slate-400">
              Передайте данные клиенту безопасным способом. Временный пароль будет запрошен к смене
              при первом входе и больше не будет показан.
            </ModalDescription>
          </ModalHeader>
          {!credentials?.orderCreated && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Аккаунт создан, но заявка не создалась. Клиент сохранён в базе; заявку можно оформить
              повторно, выбрав его как существующего.
            </p>
          )}
          <dl className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
            <div>
              <dt className="text-xs text-slate-500">Логин (электронная почта)</dt>
              <dd className="mt-1 font-semibold break-all">{credentials?.login}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Временный пароль</dt>
              <dd className="mt-1 font-mono font-semibold break-all select-all">
                {credentials?.password}
              </dd>
            </div>
          </dl>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setCredentials(null)}
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              Я сохранил данные
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Modal>
  );
};
