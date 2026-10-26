import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ImagePlus, Package, Plus, Trash2, Wrench } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";
import { ProcurementInventoryEditor } from "@/features/procurement/procurement-inventory-editor";

import {
  type RepairCatalogItem,
  createRepairCatalogItem,
  deleteCatalogProductImage,
  getRepairCatalog,
  updateRepairCatalogItem,
  uploadCatalogProductImage,
} from "@/lib/api";

const itemTypeLabels = { SERVICE: "Услуги", SPARE_PART: "Запчасти", PRODUCT: "Товары" } as const;
const tracksStock = (type: RepairCatalogItem["type"]) => type !== "SERVICE";
const defaultMinimumStockQuantity = 3;

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

  const submitNewItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate(
      {
        type: newType,
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
      { onSuccess: () => form.reset() },
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
          {(["SERVICE", "SPARE_PART", "PRODUCT"] as const).map((type) => {
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
                        onImageUpload={(file) => uploadImage.mutate({ id: item.id, file })}
                        onImageDelete={(objectId) => deleteImage.mutate({ id: item.id, objectId })}
                        imageBusy={uploadImage.isPending || deleteImage.isPending}
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
  onImageUpload,
  onImageDelete,
  imageBusy,
}: {
  item: RepairCatalogItem;
  editable: boolean;
  saving: boolean;
  imageBusy: boolean;
  onImageUpload: (file: File) => void;
  onImageDelete: (objectId: string) => void;
  onSave: (
    input: Partial<
      Pick<
        RepairCatalogItem,
        | "type"
        | "name"
        | "description"
        | "unitPriceRub"
        | "stockQuantity"
        | "minimumStockQuantity"
        | "active"
      >
    >,
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
      ...(type === "PRODUCT"
        ? { description: String(data.get("description")).trim() || null }
        : {}),
      unitPriceRub: Number(data.get("unitPriceRub")),
      ...(tracksStock(type)
        ? {
            stockQuantity: Number(data.get("stockQuantity")),
            minimumStockQuantity: Number(data.get("minimumStockQuantity")),
          }
        : {}),
    });
    setShowEditor(false);
  };

  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {item.unitPriceRub.toLocaleString("ru-RU")} ₽
            {tracksStock(item.type)
              ? item.stockQuantity === null
                ? " · Остаток не задан"
                : ` · Остаток: ${item.stockQuantity} шт.`
              : ""}
            {tracksStock(item.type) && item.stockQuantity !== null
              ? ` · Порог: ${item.minimumStockQuantity ?? defaultMinimumStockQuantity} шт.`
              : ""}
            {` · ${item.active ? "Активна" : "Скрыта"}`}
          </p>
          {item.active &&
            tracksStock(item.type) &&
            item.stockQuantity !== null &&
            (item.stockQuantity === 0 ||
              item.stockQuantity <= (item.minimumStockQuantity ?? defaultMinimumStockQuantity)) && (
              <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                {item.stockQuantity === 0
                  ? "Закончилась — пополните запас"
                  : `Мало на складе · осталось ${item.stockQuantity} шт.`}
              </p>
            )}
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
      {item.type === "PRODUCT" && item.description && (
        <p className="mt-3 max-w-3xl text-sm leading-6 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {item.description}
        </p>
      )}
      {item.type === "PRODUCT" && editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.imageObjectIds.map((objectId, index) => (
            <div key={objectId} className="relative">
              <ProtectedImage
                objectId={objectId}
                alt={`Фото ${index + 1}: ${item.name}`}
                className="size-20 rounded-xl object-cover"
              />
              <button
                type="button"
                disabled={imageBusy}
                onClick={() => onImageDelete(objectId)}
                aria-label={`Удалить фото ${index + 1}: ${item.name}`}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-white text-rose-600 shadow hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-900"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          {item.imageObjectIds.length < 4 && (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
              <ImagePlus size={16} aria-hidden="true" />
              {`Фото ${item.imageObjectIds.length}/4 · добавить`}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={imageBusy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) onImageUpload(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          )}
        </div>
      )}
      {showEditor && editable && (
        <form
          onSubmit={submit}
          className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-800"
        >
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {(["SERVICE", "SPARE_PART", "PRODUCT"] as const).map((value) => (
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
          {type === "PRODUCT" && (
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Описание товара
              <textarea
                name="description"
                defaultValue={item.description ?? ""}
                maxLength={2000}
                rows={3}
                className="resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          )}
          {tracksStock(type) && (
            <>
              <label className="grid gap-1 text-sm font-medium">
                Остаток, шт.
                <input
                  name="stockQuantity"
                  type="number"
                  defaultValue={
                    tracksStock(item.type) && item.stockQuantity !== null ? item.stockQuantity : ""
                  }
                  min={0}
                  max={2147483647}
                  step={1}
                  required
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
                {tracksStock(item.type) && item.stockQuantity === null && (
                  <span className="text-xs font-normal text-slate-500">
                    Учёт остатка ещё не настроен — укажите фактическое количество.
                  </span>
                )}
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Минимальный остаток для сигнала, шт.
                <input
                  name="minimumStockQuantity"
                  type="number"
                  defaultValue={
                    tracksStock(item.type)
                      ? (item.minimumStockQuantity ?? defaultMinimumStockQuantity)
                      : defaultMinimumStockQuantity
                  }
                  min={0}
                  max={2147483647}
                  step={1}
                  required
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
                <span className="text-xs font-normal text-slate-500">
                  0 — сигнал только при нулевом остатке.
                </span>
              </label>
            </>
          )}
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
