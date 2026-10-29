import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Power } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";
import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import {
  createProcurementSupplier,
  type ProcurementSupplier,
  type ProcurementSupplierInput,
  updateProcurementSupplier,
} from "@/features/procurement/procurement-api";

type SupplierManagementProps = {
  suppliers: ProcurementSupplier[];
};

type SupplierEditor = { kind: "new" } | { kind: "edit"; supplier: ProcurementSupplier };

const SupplierFormDialog = ({
  editor,
  onClose,
}: {
  editor: SupplierEditor;
  onClose: () => void;
}) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const supplier = editor.kind === "edit" ? editor.supplier : null;
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [note, setNote] = useState(supplier?.note ?? "");

  const save = useMutation({
    mutationFn: (input: ProcurementSupplierInput) =>
      supplier
        ? updateProcurementSupplier(token!, supplier.id, input)
        : createProcurementSupplier(token!, input),
    onSuccess: async () => {
      toast.success(supplier ? "Поставщик обновлён." : "Поставщик добавлен.");
      await queryClient.invalidateQueries({ queryKey: ["procurement-suppliers", token] });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить поставщика."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate({
      name: name.trim(),
      contactName: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      note: note.trim() || null,
    });
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{supplier ? "Изменить поставщика" : "Новый поставщик"}</ModalTitle>
          <ModalDescription>
            Контакты будут доступны сотрудникам закупки при оформлении поступления.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Название поставщика <span aria-hidden="true">*</span>
            <input
              autoComplete="organization"
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              maxLength={160}
              minLength={2}
              onChange={(event) => setName(event.currentTarget.value)}
              required
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Контактное лицо
            <input
              autoComplete="name"
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              maxLength={120}
              onChange={(event) => setContactName(event.currentTarget.value)}
              value={contactName}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Телефон
              <input
                autoComplete="tel"
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                maxLength={32}
                onChange={(event) => setPhone(event.currentTarget.value)}
                type="tel"
                value={phone}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Электронная почта
              <input
                autoComplete="email"
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                maxLength={320}
                onChange={(event) => setEmail(event.currentTarget.value)}
                type="email"
                value={email}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Заметка
            <textarea
              className="min-h-20 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"
              maxLength={1000}
              onChange={(event) => setNote(event.currentTarget.value)}
              value={note}
            />
          </label>
          <ModalFooter>
            <button
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700"
              disabled={save.isPending}
              onClick={onClose}
              type="button"
            >
              Отмена
            </button>
            <button
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={save.isPending || name.trim().length < 2}
              type="submit"
            >
              {save.isPending ? "Сохраняем…" : "Сохранить"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export const ProcurementSuppliers = ({ suppliers }: SupplierManagementProps) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<SupplierEditor | null>(null);
  const status = useMutation({
    mutationFn: ({ supplier, isActive }: { supplier: ProcurementSupplier; isActive: boolean }) =>
      updateProcurementSupplier(token!, supplier.id, { isActive }),
    onSuccess: async (_data, variables) => {
      toast.success(variables.isActive ? "Поставщик снова доступен." : "Поставщик отключён.");
      await queryClient.invalidateQueries({ queryKey: ["procurement-suppliers", token] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить поставщика."),
  });

  return (
    <>
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Поставщики</h2>
            <p className="mt-1 text-sm text-slate-500">
              Отключённых поставщиков можно включить снова; записи закупок сохраняются.
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
            onClick={() => setEditor({ kind: "new" })}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            Добавить поставщика
          </button>
        </div>
        {suppliers.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">
            Список пока пуст. Добавьте поставщика, чтобы оформить поступление.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {suppliers.map((supplier) => (
              <li
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                key={supplier.id}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Building2 size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{supplier.name}</p>
                      {!supplier.isActive && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                          Отключён
                        </span>
                      )}
                    </div>
                    {(supplier.contactName || supplier.phone || supplier.email) && (
                      <p className="mt-1 text-sm text-slate-500">
                        {[supplier.contactName, supplier.phone, supplier.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {supplier.note && <p className="mt-1 text-sm text-slate-500">{supplier.note}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2 text-xs font-semibold dark:border-slate-700"
                        onClick={() => setEditor({ kind: "edit", supplier })}
                        type="button"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Изменить
                      </button>
                      <button
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2 text-xs font-semibold dark:border-slate-700"
                        disabled={status.isPending}
                        onClick={() => status.mutate({ supplier, isActive: !supplier.isActive })}
                        type="button"
                      >
                        <Power size={13} aria-hidden="true" />
                        {supplier.isActive ? "Отключить" : "Включить"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {editor && (
        <SupplierFormDialog
          editor={editor}
          key={editor.kind === "edit" ? editor.supplier.id : "new"}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
};
