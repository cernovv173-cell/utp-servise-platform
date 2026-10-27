import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import {
  Modal,
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
  deleteAdminCustomer,
  getAdminCustomers,
  updateAdminCustomer,
} from "@/lib/api";

const CustomerEditor = ({
  customer,
  saving,
  onSave,
  onCancel,
}: {
  customer: AdminCustomer;
  saving: boolean;
  onSave: (input: { email: string; displayName: string; phoneNumber: string | null }) => void;
  onCancel: () => void;
}) => (
  <form
    className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3 dark:bg-slate-900"
    onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSave({
        displayName: String(data.get("displayName")).trim(),
        email: String(data.get("email")).trim(),
        phoneNumber: String(data.get("phoneNumber")).trim() || null,
      });
    }}
  >
    <label className="grid gap-1 text-sm font-medium">
      Имя клиента{"\u00a0"}
      <span aria-hidden="true">*</span>
      <input
        name="displayName"
        defaultValue={customer.displayName}
        required
        minLength={2}
        maxLength={120}
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
    <label className="grid gap-1 text-sm font-medium">
      Электронная почта{"\u00a0"}
      <span aria-hidden="true">*</span>
      <input
        name="email"
        type="email"
        defaultValue={customer.email}
        required
        maxLength={320}
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
    <label className="grid gap-1 text-sm font-medium">
      Телефон
      <input
        name="phoneNumber"
        type="tel"
        defaultValue={customer.phoneNumber ?? ""}
        maxLength={32}
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
      />
    </label>
    <div className="flex gap-2 md:col-span-3">
      <button
        type="submit"
        disabled={saving}
        className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        Сохранить
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
      >
        Отмена
      </button>
    </div>
  </form>
);

export const CustomerManagement = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<NewAdminCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<AdminCustomer | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const customersQuery = useQuery({
    queryKey: ["admin-customers", token, search, page],
    queryFn: ({ signal }) => getAdminCustomers(token!, search, page, 20, signal),
    enabled: Boolean(token),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-customers", token] });
  const create = useMutation({
    mutationFn: (input: { email: string; displayName: string; phoneNumber?: string }) =>
      createAdminCustomer(token!, input),
    onSuccess: async (result) => {
      setCreatedCustomer(result);
      toast.success("Клиент добавлен. Сохраните временный пароль — повторно он не появится.");
      setPage(1);
      setSearch("");
      setSearchInput("");
      await invalidate();
    },
    onError: () => toast.error("Не удалось добавить клиента. Проверьте адрес почты."),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { email: string; displayName: string; phoneNumber: string | null };
    }) => updateAdminCustomer(token!, id, input),
    onSuccess: async () => {
      setEditingId(null);
      toast.success("Данные клиента обновлены.");
      await invalidate();
    },
    onError: () => toast.error("Не удалось сохранить данные клиента."),
  });
  const remove = useMutation({
    mutationFn: (customerId: string) => deleteAdminCustomer(token!, customerId),
    onSuccess: async ({ customer }) => {
      setDeletingCustomer(null);
      setDeleteConfirmation("");
      setEditingId(null);
      toast.success(
        `Клиент ${customer.displayName} и его история удалены без возможности восстановления.`,
      );
      await queryClient.invalidateQueries();
    },
    onError: () =>
      toast.error(
        "Не удалось завершить удаление. Учётная запись могла быть отключена — попробуйте удалить клиента ещё раз.",
      ),
  });
  const customers = customersQuery.data?.customers ?? [];
  const pagination = customersQuery.data?.pagination;

  return (
    <div className="grid gap-6">
      <SectionCard>
        <h2 className="font-semibold">Добавить клиента</h2>
        <p className="mt-1 text-sm text-slate-500">
          Для входа будет создан временный пароль, который клиент сменит при первом входе.
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(event.currentTarget);
            const phoneNumber = String(data.get("phoneNumber")).trim();
            create.mutate(
              {
                displayName: String(data.get("displayName")).trim(),
                email: String(data.get("email")).trim(),
                ...(phoneNumber ? { phoneNumber } : {}),
              },
              { onSuccess: () => form.reset() },
            );
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            Имя{"\u00a0"}
            <span aria-hidden="true">*</span>
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={120}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Электронная почта{"\u00a0"}
            <span aria-hidden="true">*</span>
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Телефон
            <input
              name="phoneNumber"
              type="tel"
              maxLength={32}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled={create.isPending}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 md:col-span-3 md:justify-self-start"
          >
            {create.isPending ? "Добавляем…" : "Создать клиента"}
          </button>
        </form>
      </SectionCard>

      {createdCustomer && (
        <SectionCard className="border border-emerald-300 dark:border-emerald-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Временный пароль нового клиента</h2>
              <p className="mt-1 text-sm text-slate-500">
                Передайте данные клиенту безопасным способом. Пароль будет запрошен при входе и
                больше не будет показан в панели.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCustomer(null)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
            >
              Скрыть
            </button>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Почта</dt>
              <dd className="font-medium">{createdCustomer.customer.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Временный пароль</dt>
              <dd className="font-mono font-semibold break-all">
                {createdCustomer.temporaryPassword}
              </dd>
            </div>
          </dl>
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold">База клиентов</h2>
            <p className="mt-1 text-sm text-slate-500">
              Поиск, редактирование и безвозвратное удаление клиента вместе со связанными записями.
            </p>
          </div>
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Имя, почта, телефон"
              maxLength={120}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm sm:w-64 dark:border-slate-700 dark:bg-slate-950"
            />
            <button className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700">
              Найти
            </button>
          </form>
        </div>
        {customersQuery.isLoading ? (
          <p className="mt-5 text-sm text-slate-500">Загружаем клиентов…</p>
        ) : customersQuery.isError ? (
          <p className="mt-5 text-sm text-rose-600">Не удалось загрузить базу клиентов.</p>
        ) : customers.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Клиенты не найдены.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {customers.map((customer) => (
              <article
                key={customer.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{customer.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {customer.email} · {customer.phoneNumber || "телефон не указан"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {customer.active ? "Активен" : "Отключён"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === customer.id ? null : customer.id)}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
                    >
                      {editingId === customer.id ? "Закрыть" : "Изменить"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setDeleteConfirmation("");
                        setDeletingCustomer(customer);
                      }}
                      disabled={remove.isPending}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
                    >
                      <Trash2 size={16} /> Удалить навсегда
                    </button>
                  </div>
                </div>
                {editingId === customer.id && (
                  <CustomerEditor
                    customer={customer}
                    saving={update.isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(input) => update.mutate({ id: customer.id, input })}
                  />
                )}
              </article>
            ))}
          </div>
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-50 dark:border-slate-700"
            >
              Назад
            </button>
            <span className="text-sm text-slate-500">
              Страница {page} из {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm disabled:opacity-50 dark:border-slate-700"
            >
              Далее
            </button>
          </div>
        )}
      </SectionCard>

      <Modal
        open={Boolean(deletingCustomer)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeletingCustomer(null);
            setDeleteConfirmation("");
          }
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Удалить клиента и всю историю?</ModalTitle>
            <ModalDescription>
              Это действие нельзя отменить. Будут удалены аккаунт и доступ клиента, заявки и
              ремонты, чеки и связанные расчёты выплат, устройства, фотографии, переписки, отзывы,
              бонусы, рефералы и участие в акциях. Остатки склада не
              пересчитываются. Записи других клиентов и общие справочники останутся.
            </ModalDescription>
          </ModalHeader>
          {deletingCustomer && (
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-medium">
                {deletingCustomer.displayName} · {deletingCustomer.email}
              </p>
              <label className="grid gap-1 text-sm font-medium">
                Для подтверждения введите электронную почту клиента
                <input
                  autoComplete="off"
                  autoFocus
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>
          )}
          <ModalFooter>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => {
                setDeletingCustomer(null);
                setDeleteConfirmation("");
              }}
              className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={
                remove.isPending ||
                !deletingCustomer ||
                deleteConfirmation !== deletingCustomer.email
              }
              onClick={() => {
                if (deletingCustomer) remove.mutate(deletingCustomer.id);
              }}
              className="min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {remove.isPending ? "Удаляем…" : "Удалить навсегда"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
