import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";

import {
  type Review,
  type ReviewShowcaseImageKind,
  deleteReviewShowcaseImage,
  uploadReviewShowcaseImage,
} from "@/lib/api";

const imageKinds: {
  kind: ReviewShowcaseImageKind;
  label: string;
  objectIdKey: "clientPhotoObjectId" | "workPhotoObjectId";
}[] = [
  { kind: "work", label: "Фото выполненной работы", objectIdKey: "workPhotoObjectId" },
  { kind: "client", label: "Фото клиента (с его согласия)", objectIdKey: "clientPhotoObjectId" },
];

export const ReviewShowcaseImages = ({ review }: { review: Review }) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [clientPhotoConsent, setClientPhotoConsent] = useState(false);
  const [pendingKind, setPendingKind] = useState<ReviewShowcaseImageKind | null>(null);

  const refreshReviews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reviews", token] }),
      queryClient.invalidateQueries({ queryKey: ["public-reviews"] }),
    ]);
  };

  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: ReviewShowcaseImageKind; file: File }) =>
      uploadReviewShowcaseImage(token!, review.id, kind, file, clientPhotoConsent),
    onMutate: ({ kind }) => setPendingKind(kind),
    onSuccess: async (_result, { kind }) => {
      toast.success(kind === "client" ? "Фото клиента сохранено." : "Фото работы сохранено.");
      if (kind === "client") setClientPhotoConsent(false);
      await refreshReviews();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить фото."),
    onSettled: () => setPendingKind(null),
  });

  const remove = useMutation({
    mutationFn: (kind: ReviewShowcaseImageKind) =>
      deleteReviewShowcaseImage(token!, review.id, kind),
    onMutate: (kind) => setPendingKind(kind),
    onSuccess: async (_result, kind) => {
      toast.success(kind === "client" ? "Фото клиента удалено." : "Фото работы удалено.");
      await refreshReviews();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось удалить фото."),
    onSettled: () => setPendingKind(null),
  });

  const handleFileChange = (kind: ReviewShowcaseImageKind, file: File | undefined) => {
    if (!file) return;
    if (kind === "client" && !clientPhotoConsent) {
      toast.error("Сначала подтвердите согласие клиента на публикацию фото.");
      return;
    }
    upload.mutate({ kind, file });
  };

  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 dark:border-slate-800">
      {imageKinds.map(({ kind, label, objectIdKey }) => {
        const objectId = review[objectIdKey];
        const busy = pendingKind === kind;
        return (
          <div key={kind} className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</p>
            {objectId && (
              <div className="mt-2 flex items-start gap-2">
                <ProtectedImage
                  objectId={objectId}
                  alt={
                    kind === "client" ? "Фото клиента для публикации" : "Фото выполненной работы"
                  }
                  className="h-20 w-28 rounded-lg object-cover"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove.mutate(kind)}
                  className="min-h-9 rounded-lg border border-rose-200 px-2 text-xs font-medium text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
                >
                  Удалить
                </button>
              </div>
            )}
            {kind === "client" && (
              <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={clientPhotoConsent}
                  onChange={(event) => setClientPhotoConsent(event.target.checked)}
                  className="mt-1 size-4 accent-blue-600"
                />
                Подтверждаю согласие клиента на размещение его фотографии на сайте.
              </label>
            )}
            <label className="mt-2 inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              {busy ? "Сохраняем…" : objectId ? "Заменить фото" : "Добавить фото"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || (kind === "client" && !clientPhotoConsent)}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  handleFileChange(kind, file);
                }}
                className="sr-only"
              />
            </label>
          </div>
        );
      })}
    </div>
  );
};
