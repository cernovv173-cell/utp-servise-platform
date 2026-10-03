import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Package, Plus, Wrench } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  type RepairCatalogItem,
  createRepairCatalogItem,
  getRepairCatalog,
  updateRepairCatalogItem,
} from "@/lib/api";

const itemTypeLabels = { SERVICE: "Услуги", SPARE_PART: "Запчасти" } as const;

const CatalogPage = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const canView = user?.role === "ADMIN" || user?.role === "TECHNICIAN";
  const items = useQuery({
    queryKey: ["repair-catalog", token],
    queryFn: ({ signal }) => getRepairCatalog(token!, signal),
    enabled: Boolean(token && canView),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["repair-catalog", token] });
  const create = useMutation({
    mutationFn: (input: Pick<RepairCatalogItem, "type" | "name" | "unitPriceRub">) =>
      createRepairCatalogItem(token!, input),
    onSuccess: async () => {
      toast.success("Позиция добавлена в каталог.");
      await refresh();
    },
    onError: () => toast.error("Не удалось добавить позицию."),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<Pick<RepairCatalogItem, "type" | "name" | "unitPriceRub" | "active">>;
    }) => updateRepairCatalogItem(token!, id, input),
    onSuccess: async () => {
      toast.success("Каталог обновлён.");
      await refresh();
    },
    onError: () => toast.error("Не удалось обновить каталог."),
  });
  const [newType, setNewType] = useState<RepairCatalogItem["type"]>("SERVICE");

  const submitNewItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate(
      {
        type: newType,
        name: String(data.get("name")).trim(),
        unitPriceRub: Number(data.get("unitPriceRub")),
      },
      { onSuccess: () => form.reset() },
    );
  };

  const catalogItems = items.data?.catalogItems ?? [];
  return (
    <AppShell active="/catalog">
      <PageTitle
        eyebrow="СПРАВОЧНИК СЕРВИСА"
        title="Каталог услуг и запчастей"
        description="Единый список и цены, которые используются при оформлении и расчёте ремонта."
      />
      {!canView ? (
        <SectionCard>
          <p className="text-sm text-slate-500">
            Каталог доступен администраторам и мастерам после входа в аккаунт.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
          {user?.role === "ADMIN" && (
            <SectionCard>
              <h2 className="flex items-center gap-2 font-semibold">
                <Plus size={18} /> Добавить позицию
              </h2>
              <form onSubmit={submitNewItem} className="mt-4 grid gap-4 md:grid-cols-2">
                <fieldset className="grid gap-2 md:col-span-2">
                  <legend className="text-sm font-medium">Тип позиции</legend>
                  <div className="flex flex-wrap gap-2">
                    {(["SERVICE", "SPARE_PART"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={newType === type}
                        onClick={() => setNewType(type)}
                        className={`min-h-10 rounded-xl border px-4 text-sm font-medium ${newType === type ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 dark:border-slate-700"}`}
                      >
                        {itemTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="grid gap-1 text-sm font-medium">
                  Название <span aria-hidden="true">*</span>
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={160}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Цена, ₽ <span aria-hidden="true">*</span>
                  <input
                    name="unitPriceRub"
                    type="number"
                    min={0}
                    max={10000000}
                    step={1}
                    required
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 md:col-span-2 md:justify-self-start"
                >
                  {create.isPending ? "Сохраняем…" : "Добавить в каталог"}
                </button>
              </form>
            </SectionCard>
          )}

          {items.isLoading && <SectionCard>Загружаем каталог…</SectionCard>}
          {items.isError && (
            <SectionCard>
              <p className="text-sm text-rose-600">
                Не удалось загрузить каталог. Попробуйте обновить страницу.
              </p>
            </SectionCard>
          )}
          {(["SERVICE", "SPARE_PART"] as const).map((type) => {
            const sectionItems = catalogItems.filter((item) => item.type === type);
            const Icon = type === "SERVICE" ? Wrench : Package;
            return (
              <SectionCard key={type}>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Icon size={18} /> {itemTypeLabels[type]}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                    {sectionItems.length}
                  </span>
                </h2>
                {sectionItems.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">В этом разделе пока нет позиций.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {sectionItems.map((item) => (
                      <CatalogItemRow
                        key={item.id}
                        item={item}
                        editable={user?.role === "ADMIN"}
                        saving={update.isPending}
                        onSave={(input) => update.mutate({ id: item.id, input })}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            );
          })}
          {!items.isLoading && catalogItems.length === 0 && (
            <SectionCard className="flex items-center gap-3 text-sm text-slate-500">
              <Boxes size={18} /> Каталог пока пуст.
            </SectionCard>
          )}
        </div>
      )}
    </AppShell>
  );
};

const CatalogItemRow = ({
  item,
  editable,
  saving,
  onSave,
}: {
  item: RepairCatalogItem;
  editable: boolean;
  saving: boolean;
  onSave: (
    input: Partial<Pick<RepairCatalogItem, "type" | "name" | "unitPriceRub" | "active">>,
  ) => void;
}) => {
  const [type, setType] = useState(item.type);
  const [showEditor, setShowEditor] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      type,
      name: String(data.get("name")).trim(),
      unitPriceRub: Number(data.get("unitPriceRub")),
    });
    setShowEditor(false);
  };

  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {item.unitPriceRub.toLocaleString("ru-RU")} ₽ · {item.active ? "Активна" : "Скрыта"}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowEditor((visible) => !visible)}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
            >
              {showEditor ? "Закрыть" : "Изменить"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave({ active: !item.active })}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
            >
              {item.active ? "Скрыть" : "Включить"}
            </button>
          </div>
        )}
      </div>
      {showEditor && editable && (
        <form
          onSubmit={submit}
          className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-800"
        >
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {(["SERVICE", "SPARE_PART"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${type === value ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 dark:border-slate-700"}`}
              >
                {itemTypeLabels[value]}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Название
            <input
              name="name"
              defaultValue={item.name}
              required
              minLength={2}
              maxLength={160}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Цена, ₽
            <input
              name="unitPriceRub"
              type="number"
              defaultValue={item.unitPriceRub}
              min={0}
              max={10000000}
              step={1}
              required
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2 md:justify-self-start"
          >
            Сохранить изменения
          </button>
        </form>
      )}
    </article>
  );
};

export const Route = createFileRoute("/catalog")({ component: CatalogPage });
