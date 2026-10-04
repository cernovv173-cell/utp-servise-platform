import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
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

import { type AdminCustomer, createAdminOrder, getAdminCustomers } from "@/lib/api";

const fieldClassName =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950";

export const AdminOrderCreate = ({ onCreated }: { onCreated: () => void }) => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [saving, setSaving] = useState(false);
  const candidates = useQuery({
    queryKey: ["admin-order-customers", token, customerSearch],
    queryFn: ({ signal }) => getAdminCustomers(token!, customerSearch.trim(), 1, 20, signal),
    enabled: Boolean(token && customerSearch.trim().length >= 2 && !customer),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer || !token) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get("contactPhone")).trim();
    setSaving(true);
    try {
      await createAdminOrder(token, {
        customerId: customer.id,
        deviceType: String(data.get("deviceType")),
        problem: String(data.get("problem")).trim(),
        ...(phone ? { contactPhone: phone } : {}),
        city: String(data.get("city")).trim(),
        street: String(data.get("street")).trim(),
        house: String(data.get("house")).trim(),
        apartment: String(data.get("apartment")).trim(),
        additionalInfo: String(data.get("additionalInfo")).trim(),
      });
      toast.success("Заявка создана и добавлена в общий список.");
      setOpen(false);
      setCustomer(null);
      setCustomerSearch("");
      form.reset();
      onCreated();
    } catch {
      toast.error("Не удалось создать заявку. Проверьте данные клиента и адрес.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Создать заявку
      </button>
      <ModalContent className="max-w-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Новая заявка для клиента</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            Заявка появится в общем списке, а её создание будет записано в истории.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          {!customer ? (
            <div className="grid gap-2 sm:col-span-2">
              <label className="grid gap-1 text-sm font-medium">
                Найти активного клиента <span aria-hidden="true">*</span>
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
                          {entry.email} · {entry.phoneNumber || "телефон не указан"}
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
                  {customer.email} · {customer.phoneNumber || "телефон не указан"}
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
            Тип устройства <span aria-hidden="true">*</span>
            <select name="deviceType" required className={fieldClassName}>
              <option value="COMPUTER">Компьютер</option>
              <option value="LAPTOP">Ноутбук</option>
              <option value="PHONE">Телефон</option>
              <option value="TABLET">Планшет</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Телефон для связи
            <input
              name="contactPhone"
              defaultValue={customer?.phoneNumber ?? ""}
              type="tel"
              minLength={7}
              maxLength={32}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Неисправность <span aria-hidden="true">*</span>
            <textarea
              name="problem"
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Город <span aria-hidden="true">*</span>
            <input name="city" required minLength={2} maxLength={120} className={fieldClassName} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Улица <span aria-hidden="true">*</span>
            <input
              name="street"
              required
              minLength={2}
              maxLength={180}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Дом <span aria-hidden="true">*</span>
            <input name="house" required minLength={1} maxLength={30} className={fieldClassName} />
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
              disabled={!customer || saving}
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Создаём…" : "Создать заявку"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
