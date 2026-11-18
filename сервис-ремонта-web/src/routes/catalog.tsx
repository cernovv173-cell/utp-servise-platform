import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ChevronDown, Package, Plus, Wrench } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CatalogItemRow } from "@/features/catalog/catalog-item-row";
import {
  defaultMinimumStockQuantity,
  itemTypeLabels,
  repairDeviceTypeLabels,
  repairDeviceTypes,
  tracksStock,
} from "@/features/catalog/catalog-model";
import { ProcurementInventoryEditor } from "@/features/procurement/procurement-inventory-editor";

import {
  type RepairCatalogItem,
  type RepairCatalogServiceCategory,
  type RepairDeviceType,
  createRepairCatalogItem,
  deleteCatalogProductImage,
  deleteRepairCatalogItem,
  getRepairCatalog,
  updateRepairCatalogItem,
  uploadCatalogProductImage,
} from "@/lib/api";

const CatalogPage = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const canView =
    user?.role === "ADMIN" || user?.role === "TECHNICIAN" || user?.role === "PROCUREMENT";
  const items = useQuery({
    queryKey: ["repair-catalog", token],
    queryFn: ({ signal }) => getRepairCatalog(token!, signal),
    enabled: Boolean(token && canView),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["repair-catalog", token] });
  const create = useMutation({
    mutationFn: (
      input: Pick<RepairCatalogItem, "type" | "name" | "unitPriceRub"> & {
        deviceTypes?: RepairDeviceType[];
        serviceCategory?: RepairCatalogServiceCategory | null;
        description?: string | null;
        stockQuantity?: number;
        minimumStockQuantity?: number;
      },
    ) => createRepairCatalogItem(token!, input),
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
      input: Partial<
        Pick<
          RepairCatalogItem,
          | "type"
          | "deviceTypes"
          | "serviceCategory"
          | "name"
          | "description"
          | "unitPriceRub"
          | "stockQuantity"
          | "minimumStockQuantity"
          | "active"
        >
      >;
    }) => updateRepairCatalogItem(token!, id, input),
    onSuccess: async () => {
      toast.success("Каталог обновлён.");
      await refresh();
    },
    onError: () => toast.error("Не удалось обновить каталог."),
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => deleteRepairCatalogItem(token!, id),
    onSuccess: async () => {
      toast.success("Позиция удалена из каталога.");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось удалить позицию."),
  });
  const uploadImage = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadCatalogProductImage(token!, id, file),
    onSuccess: async () => {
      toast.success("Фото товара добавлено.");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось добавить фото товара."),
  });
  const deleteImage = useMutation({
    mutationFn: ({ id, objectId }: { id: string; objectId: string }) =>
      deleteCatalogProductImage(token!, id, objectId),
    onSuccess: async () => {
      toast.success("Фото удалено.");
      await refresh();
    },
    onError: () => toast.error("Не удалось удалить фото товара."),
  });
  const [newType, setNewType] = useState<RepairCatalogItem["type"]>("SERVICE");
  const [newDeviceTypes, setNewDeviceTypes] = useState<RepairDeviceType[]>(repairDeviceTypes);
  const [newServiceCategory, setNewServiceCategory] = useState<RepairCatalogServiceCategory | null>(
    null,
  );
  const [deviceFilter, setDeviceFilter] = useState<"ALL" | RepairDeviceType>("ALL");

  const submitNewItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate(
      {
        type: newType,
        ...(newType !== "PRODUCT" ? { deviceTypes: newDeviceTypes } : {}),
        ...(newType === "SERVICE" ? { serviceCategory: newServiceCategory } : {}),
        name: String(data.get("name")).trim(),
        ...(newType === "PRODUCT"
          ? { description: String(data.get("description")).trim() || null }
          : {}),
        unitPriceRub: Number(data.get("unitPriceRub")),
        ...(tracksStock(newType)
          ? {
              stockQuantity: Number(data.get("stockQuantity")),
              minimumStockQuantity: Number(data.get("minimumStockQuantity")),
            }
          : {}),
      },
      {
        onSuccess: () => {
          form.reset();
          setNewServiceCategory(null);
        },
      },
    );
  };

  const catalogItems = items.data?.catalogItems ?? [];
  const trackedInventory = catalogItems.filter(
    (item) => item.active && tracksStock(item.type) && item.stockQuantity !== null,
  );
  const outOfStockItems = trackedInventory.filter((item) => item.stockQuantity === 0);
  const lowStockItems = trackedInventory.filter(
    (item) =>
      item.stockQuantity !== null &&
      item.stockQuantity > 0 &&
      item.stockQuantity <= (item.minimumStockQuantity ?? defaultMinimumStockQuantity),
  );
  const restockItems = trackedInventory.filter(
    (item) =>
      item.stockQuantity !== null &&
      (item.stockQuantity === 0 ||
        item.stockQuantity <= (item.minimumStockQuantity ?? defaultMinimumStockQuantity)),
  );

  if (user?.role === "PROCUREMENT") {
    return (
      <AppShell active="/catalog">
        <PageTitle
          eyebrow="СКЛАД"
          title="Товары и запчасти"
          description="Проверяйте остатки и обновляйте количество на складе и минимальный запас."
        />
        <ProcurementInventoryEditor
          items={catalogItems}
          token={token!}
          isLoading={items.isLoading}
          isError={items.isError}
          onSaved={refresh}
        />
      </AppShell>
    );
  }

  return (
    <AppShell active="/catalog">
      <PageTitle
        eyebrow="СПРАВОЧНИК СЕРВИСА"
        title="Каталог услуг, запчастей и товаров"
        description="Единый список и цены, которые используются при оформлении и расчёте ремонта."
      />
      {!canView ? (
        <SectionCard>
          <p className="text-sm text-slate-500">
            Каталог доступен администраторам, мастерам и мастерам закупки после входа в аккаунт.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
          <SectionCard>
            <h2 className="flex items-center gap-2 font-semibold">
              <Boxes size={18} /> Контроль остатков
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {trackedInventory.length === 0
                ? "У активных запчастей и товаров пока нет включённого учёта остатка."
                : restockItems.length === 0
                  ? `На складе ${trackedInventory.length} активных позиций — запас в норме.`
                  : `К пополнению: ${restockItems.length} · закончилось: ${outOfStockItems.length} · ниже порога: ${lowStockItems.length}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Порог пополнения настраивается отдельно в карточке каждой запчасти или товара. Нулевой
              остаток всегда отмечается, даже если порог установлен в 0.
            </p>
          </SectionCard>
          {user?.role === "ADMIN" && (
            <SectionCard>
              <h2 className="flex items-center gap-2 font-semibold">
                <Plus size={18} /> Добавить позицию
              </h2>
              <form onSubmit={submitNewItem} className="mt-4 grid gap-4 md:grid-cols-2">
                <fieldset className="grid gap-2 md:col-span-2">
                  <legend className="text-sm font-medium">Тип позиции</legend>
                  <div className="flex flex-wrap gap-2">
                    {(["SERVICE", "SPARE_PART", "PRODUCT"] as const).map((type) => (
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
                {newType !== "PRODUCT" && (
                  <fieldset className="grid gap-2 md:col-span-2">
                    <legend className="text-sm font-medium">Для каких устройств подходит</legend>
                    <div className="flex flex-wrap gap-2">
                      {repairDeviceTypes.map((deviceType) => {
                        const selected = newDeviceTypes.includes(deviceType);
                        return (
                          <button
                            key={deviceType}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setNewDeviceTypes((current) =>
                                selected
                                  ? current.filter((value) => value !== deviceType)
                                  : [...current, deviceType],
                              )
                            }
                            className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${selected ? "border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200" : "border-slate-200 dark:border-slate-700"}`}
                          >
                            {repairDeviceTypeLabels[deviceType]}
                          </button>
                        );
                      })}
                    </div>
                    {newDeviceTypes.length === 0 && (
                      <p className="text-xs text-rose-600">Выберите хотя бы один тип устройства.</p>
                    )}
                  </fieldset>
                )}
                {newType === "SERVICE" && (
                  <fieldset className="grid gap-2 md:col-span-2">
                    <legend className="text-sm font-medium">Группа услуги</legend>
                    <button
                      type="button"
                      aria-pressed={newServiceCategory === "SOFTWARE"}
                      onClick={() =>
                        setNewServiceCategory((current) =>
                          current === "SOFTWARE" ? null : "SOFTWARE",
                        )
                      }
                      className={`min-h-9 justify-self-start rounded-lg border px-3 text-xs font-medium ${newServiceCategory === "SOFTWARE" ? "border-violet-600 bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200" : "border-slate-200 dark:border-slate-700"}`}
                    >
                      ПО · программное обеспечение
                    </button>
                  </fieldset>
                )}
                <label className="grid gap-1 text-sm font-medium">
                  Название{"\u00a0"}
                  <span aria-hidden="true">*</span>
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={160}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Цена, ₽{"\u00a0"}
                  <span aria-hidden="true">*</span>
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
                {newType === "PRODUCT" && (
                  <label className="grid gap-1 text-sm font-medium md:col-span-2">
                    Описание товара
                    <textarea
                      name="description"
                      maxLength={2000}
                      rows={3}
                      className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"
                      placeholder="Расскажите о характеристиках и особенностях товара"
                    />
                  </label>
                )}
                {tracksStock(newType) && (
                  <>
                    <label className="grid gap-1 text-sm font-medium">
                      Начальный остаток, шт.{"\u00a0"}
                      <span aria-hidden="true">*</span>
                      <input
                        name="stockQuantity"
                        type="number"
                        min={0}
                        max={2147483647}
                        step={1}
                        required
                        defaultValue={0}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Минимальный остаток для сигнала, шт.
                      <input
                        name="minimumStockQuantity"
                        type="number"
                        min={0}
                        max={2147483647}
                        step={1}
                        required
                        defaultValue={defaultMinimumStockQuantity}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                      />
                      <span className="text-xs font-normal text-slate-500">
                        0 — сигнал только при нулевом остатке.
                      </span>
                    </label>
                  </>
                )}
                <button
                  type="submit"
                  disabled={
                    create.isPending || (newType !== "PRODUCT" && newDeviceTypes.length === 0)
                  }
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
          <SectionCard>
            <h2 className="font-semibold">Услуги и запчасти для устройства</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["ALL", ...repairDeviceTypes] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={deviceFilter === value}
                  onClick={() => setDeviceFilter(value)}
                  className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${deviceFilter === value ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 dark:border-slate-700"}`}
                >
                  {value === "ALL" ? "Все устройства" : repairDeviceTypeLabels[value]}
                </button>
              ))}
            </div>
          </SectionCard>
          {[
            { key: "SERVICE", type: "SERVICE", label: "Услуги", software: false },
            { key: "SOFTWARE", type: "SERVICE", label: "ПО", software: true },
            { key: "SPARE_PART", type: "SPARE_PART", label: "Запчасти", software: false },
            { key: "PRODUCT", type: "PRODUCT", label: "Товары", software: false },
          ].map((section) => {
            const sectionItems = catalogItems.filter((item) => {
              if (item.type !== section.type) return false;
              if (
                section.type === "SERVICE" &&
                (item.serviceCategory === "SOFTWARE") !== section.software
              ) {
                return false;
              }
              return (
                section.type === "PRODUCT" ||
                deviceFilter === "ALL" ||
                item.deviceTypes.includes(deviceFilter)
              );
            });
            const Icon = section.type === "SERVICE" ? Wrench : Package;
            return (
              <details
                key={section.key}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50"
              >
                <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon size={18} aria-hidden="true" />
                    <span>{section.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500 dark:bg-slate-800">
                      {sectionItems.length}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="grid gap-3 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                  {sectionItems.length === 0 ? (
                    <p className="text-sm text-slate-500">В этом разделе пока нет позиций.</p>
                  ) : (
                    sectionItems.map((item) => (
                      <CatalogItemRow
                        key={`${item.id}:${item.type}:${item.serviceCategory ?? "general"}:${item.deviceTypes.join(",")}`}
                        item={item}
                        editable={user?.role === "ADMIN"}
                        saving={update.isPending}
                        deleteBusy={deleteItem.isPending}
                        onSave={(input) => update.mutate({ id: item.id, input })}
                        onImageUpload={(file) => uploadImage.mutate({ id: item.id, file })}
                        onImageDelete={(objectId) => deleteImage.mutate({ id: item.id, objectId })}
                        onDelete={() => deleteItem.mutateAsync(item.id)}
                        imageBusy={uploadImage.isPending || deleteImage.isPending}
                      />
                    ))
                  )}
                </div>
              </details>
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

export const Route = createFileRoute("/catalog")({ component: CatalogPage });
