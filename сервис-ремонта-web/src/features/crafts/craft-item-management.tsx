import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2, X } from "lucide-react";
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
import { ProtectedImage } from "@/components/protected-image";

import {
  type CraftItem,
  createCraftItem,
  deleteCraftItem,
  deleteCraftItemImage,
  updateCraftItem,
  uploadCraftItemImage,
} from "@/lib/api";

import { craftItemImageIds } from "./craft-item-images";

type CraftItemInput = Parameters<typeof createCraftItem>[1];
type CraftItemUpdate = Pick<
  CraftItem,
  "title" | "description" | "priceRub" | "stockQuantity" | "isPublished" | "customOrderAvailable"
>;

export const CraftItemManagement = ({
  items,
  token,
  onSaved,
}: {
  items: CraftItem[];
  token: string;
  onSaved: () => Promise<void>;
}) => {
  const client = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [photoSelectionNotice, setPhotoSelectionNotice] = useState("");
  const [createNotice, setCreateNotice] = useState("");

  const refreshItems = async () => {
    await client.invalidateQueries({ queryKey: ["craft-items", token] });
    await onSaved();
  };

  const create = useMutation({
    mutationFn: (input: CraftItemInput) => createCraftItem(token, input),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CraftItemUpdate }) =>
      updateCraftItem(token, id, data),
    onSuccess: refreshItems,
    onError: (error) => toast.error(error.message || "Не удалось сохранить карточку."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCraftItem(token, id),
    onSuccess: refreshItems,
    onError: (error) => toast.error(error.message || "Не удалось удалить карточку."),
  });
  const uploadImage = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadCraftItemImage(token, id, file),
    onSuccess: refreshItems,
    onError: (error) => toast.error(error.message || "Не удалось загрузить фото."),
  });
  const removeImage = useMutation({
    mutationFn: ({ id, objectId }: { id: string; objectId: string }) =>
      deleteCraftItemImage(token, id, objectId),
    onSuccess: refreshItems,
    onError: (error) => toast.error(error.message || "Не удалось удалить фото."),
  });

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setCreateNotice("");
    setIsCreating(true);

    try {
      const { item } = await create.mutateAsync({
        title: String(data.get("title")).trim(),
        description: String(data.get("description")).trim(),
        priceRub: Number(data.get("priceRub")),
        stockQuantity: Number(data.get("stockQuantity") || 0),
        isPublished: data.get("published") === "on",
        customOrderAvailable: data.get("custom") === "on",
      });

      let failedPhotoCount = 0;
      for (const file of newPhotos) {
        try {
          await uploadCraftItemImage(token, item.id, file);
        } catch {
          failedPhotoCount += 1;
        }
      }
      form.reset();
      setNewPhotos([]);
      setPhotoSelectionNotice("");
      await refreshItems();
      setCreateNotice(
        failedPhotoCount > 0
          ? `Карточка создана, но не удалось загрузить фото: ${failedPhotoCount}. Добавьте их в списке ниже.`
          : "Карточка изделия создана.",
      );
    } catch (error) {
      setCreateNotice(
        error instanceof Error ? error.message : "Не удалось создать карточку изделия.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SectionCard className="mb-6">
      <h2 className="font-semibold">Управление изделиями</h2>
      <p className="mt-1 text-sm text-slate-500">
        Опубликованные карточки можно редактировать или удалить. Для каждой карточки доступно до
        трёх фото.
      </p>
      <form onSubmit={createItem} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Название
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Цена, ₽
          <input
            name="priceRub"
            type="number"
            required
            min={0}
            max={10000000}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Готово на складе, шт.
          <input
            name="stockQuantity"
            type="number"
            required
            min={0}
            max={100000}
            defaultValue={0}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          Описание
          <textarea
            name="description"
            maxLength={4000}
            rows={2}
            className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Фото — до трёх
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="text-xs"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              setNewPhotos(files.slice(0, 3));
              setPhotoSelectionNotice(
                files.length > 3 ? "Выбраны первые три фотографии — это максимум." : "",
              );
              event.currentTarget.value = "";
            }}
          />
          <span className="text-xs font-normal text-slate-500">Выбрано: {newPhotos.length}/3</span>
        </label>
        <div className="grid content-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" className="size-4 accent-blue-600" />
            Опубликовать
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="custom"
              defaultChecked
              className="size-4 accent-blue-600"
            />
            Допускается заказной вариант
          </label>
        </div>
        {photoSelectionNotice && (
          <p className="text-sm text-amber-700 dark:text-amber-300">{photoSelectionNotice}</p>
        )}
        <button
          disabled={isCreating || create.isPending}
          className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isCreating || create.isPending ? "Сохраняем…" : "Добавить изделие"}
        </button>
        {createNotice && (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            {createNotice}
          </p>
        )}
      </form>

      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <CraftItemEditor
            key={`${item.id}:${item.updatedAt ?? ""}`}
            item={item}
            saving={update.isPending}
            deleting={remove.isPending}
            imageBusy={uploadImage.isPending || removeImage.isPending}
            onSave={(data) => update.mutate({ id: item.id, data })}
            onDelete={() => remove.mutate(item.id)}
            onImageUpload={(file) => uploadImage.mutate({ id: item.id, file })}
            onImageDelete={(objectId) => removeImage.mutate({ id: item.id, objectId })}
          />
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">Карточек изделий пока нет.</p>}
      </div>
    </SectionCard>
  );
};

const CraftItemEditor = ({
  item,
  saving,
  deleting,
  imageBusy,
  onSave,
  onDelete,
  onImageUpload,
  onImageDelete,
}: {
  item: CraftItem;
  saving: boolean;
  deleting: boolean;
  imageBusy: boolean;
  onSave: (data: CraftItemUpdate) => void;
  onDelete: () => void;
  onImageUpload: (file: File) => void;
  onImageDelete: (objectId: string) => void;
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const imageIds = craftItemImageIds(item);
  const editorId = `craft-item-editor-${item.id}`;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      title: String(data.get("title")).trim(),
      description: String(data.get("description")).trim(),
      priceRub: Number(data.get("priceRub")),
      stockQuantity: Number(data.get("stockQuantity")),
      isPublished: data.get("published") === "on",
      customOrderAvailable: data.get("custom") === "on",
    });
  };

  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{item.title}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {item.isPublished ? "Опубликовано" : "Черновик"}
          </span>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={editorId}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {isExpanded ? "Свернуть" : "Развернуть"}
          </button>
          <button
            type="button"
            disabled={deleting || saving}
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Удалить карточку «${item.title}»`}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
          >
            <Trash2 size={15} aria-hidden="true" />
            Удалить карточку
          </button>
        </div>
      </div>

      <div id={editorId} hidden={!isExpanded} className="space-y-4">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Название
            <input
              name="title"
              required
              minLength={2}
              maxLength={160}
              defaultValue={item.title}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Цена, ₽
            <input
              name="priceRub"
              type="number"
              required
              min={0}
              max={10000000}
              defaultValue={item.priceRub}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Остаток, шт.
            <input
              name="stockQuantity"
              type="number"
              required
              min={0}
              max={100000}
              defaultValue={item.stockQuantity}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Описание
            <textarea
              name="description"
              maxLength={4000}
              rows={2}
              defaultValue={item.description}
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="published"
                defaultChecked={item.isPublished}
                className="size-4 accent-blue-600"
              />
              Опубликовано
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="custom"
                defaultChecked={item.customOrderAvailable}
                className="size-4 accent-blue-600"
              />
              Можно изготовить на заказ
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {imageIds.map((objectId, index) => (
            <div key={objectId} className="relative">
              <ProtectedImage
                objectId={objectId}
                alt={`Фото ${index + 1}: ${item.title}`}
                className="size-20 rounded-xl object-cover"
              />
              <button
                type="button"
                disabled={imageBusy}
                onClick={() => onImageDelete(objectId)}
                aria-label={`Удалить фото ${index + 1}: ${item.title}`}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-white text-rose-600 shadow hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-900"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          {imageIds.length < 3 && (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
              <ImagePlus size={16} aria-hidden="true" />
              Добавить фото {imageIds.length}/3
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
      </div>

      <Modal open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Удалить карточку изделия?</ModalTitle>
            <ModalDescription>
              «{item.title}» и его фотографии будут удалены из магазина. Если по изделию есть
              незавершённый заказ, сервер не позволит удалить карточку. История завершённых заказов
              сохранится.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm dark:border-slate-700"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                onDelete();
                setConfirmingDelete(false);
              }}
              className="min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "Удаляем…" : "Удалить полностью"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </article>
  );
};
