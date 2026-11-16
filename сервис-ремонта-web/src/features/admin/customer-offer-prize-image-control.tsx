import { useState } from "react";
import { toast } from "sonner";

import { ProtectedImage } from "@/components/protected-image";

import { deleteAdminCustomerOfferPrizeImage, uploadAdminCustomerOfferPrizeImage } from "@/lib/api";

export const CustomerOfferPrizeImageControl = ({
  token,
  offerId,
  place,
  imageObjectId,
  onChanged,
}: {
  token: string;
  offerId: string;
  place: number;
  imageObjectId: string | null;
  onChanged: () => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = `offer-${offerId}-prize-${place}-image`;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Выберите JPG, PNG или WebP размером не более 5 МБ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await uploadAdminCustomerOfferPrizeImage(token, offerId, place, file);
      await onChanged();
    } catch {
      const message = "Не удалось сохранить фото. Повторите попытку.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteAdminCustomerOfferPrizeImage(token, offerId, place);
      await onChanged();
    } catch {
      const message = "Не удалось удалить фото. Обновите список и повторите попытку.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {imageObjectId && (
        <ProtectedImage
          objectId={imageObjectId}
          alt={`Фото приза за ${place}-е место`}
          className="size-14 rounded-lg object-cover"
        />
      )}
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? "Сохраняем…" : imageObjectId ? "Заменить фото" : "Добавить фото"}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void upload(file);
        }}
      />
      {imageObjectId && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="min-h-9 rounded-lg px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40"
        >
          Удалить фото
        </button>
      )}
      <span className="text-xs text-slate-400">JPG, PNG или WebP · до 5 МБ</span>
      {error && (
        <p role="alert" className="w-full text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
};
