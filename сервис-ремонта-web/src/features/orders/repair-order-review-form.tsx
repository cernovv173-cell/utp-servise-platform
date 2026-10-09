import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Star } from "lucide-react";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/modal";

import { useAuth } from "@/features/auth/auth-context";

import { createRepairOrderReview, uploadRepairOrderReviewPhoto } from "@/lib/api";

export const RepairOrderReviewForm = ({
  orderId,
  serviceNumber,
}: {
  orderId: string;
  serviceNumber: string;
}) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      const { review } = await createRepairOrderReview(token!, { orderId, rating, comment });
      if (!image) return { photoSaved: true };
      try {
        await uploadRepairOrderReviewPhoto(token!, review.id, image);
        return { photoSaved: true };
      } catch {
        return { photoSaved: false };
      }
    },
    onSuccess: async ({ photoSaved }) => {
      setOpen(false);
      setComment("");
      setImage(null);
      toast.success(
        photoSaved ? "Отзыв отправлен на модерацию." : "Отзыв сохранён, но фото не загрузилось.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", token] }),
        queryClient.invalidateQueries({ queryKey: ["reviews", token] }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отправить отзыв."),
  });
  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    setImage(event.currentTarget.files?.[0] ?? null);
  };
  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit.mutate();
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Оставить отзыв
      </button>
      <ModalContent className="max-w-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Отзыв о ремонте · {serviceNumber}</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            Расскажите, как прошёл ремонт. Отзыв появится после проверки администрацией.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submitForm} className="mt-4 grid gap-4">
          <fieldset>
            <legend className="text-sm font-medium">Оценка</legend>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Оценка ${value} из 5`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className="grid size-10 place-items-center rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Star
                    size={22}
                    fill={value <= rating ? "currentColor" : "none"}
                    className={value <= rating ? "text-amber-500" : "text-slate-400"}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-medium">
            Комментарий
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 2000))}
              minLength={3}
              maxLength={2000}
              required
              rows={4}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 justify-self-start rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700">
            <ImagePlus size={16} aria-hidden="true" />
            {image ? image.name : "Добавить фотографию (необязательно)"}
            <input type="file" accept="image/*" className="sr-only" onChange={chooseImage} />
          </label>
          <button
            type="submit"
            disabled={submit.isPending || comment.trim().length < 3}
            className="min-h-10 justify-self-start rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submit.isPending ? "Отправляем…" : "Отправить отзыв"}
          </button>
        </form>
      </ModalContent>
    </Modal>
  );
};
