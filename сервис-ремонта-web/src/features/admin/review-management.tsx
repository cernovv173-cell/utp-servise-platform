import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock } from "lucide-react";

import { SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { ReviewShowcaseImages } from "@/features/admin/review-showcase-images";
import { useAuth } from "@/features/auth/auth-context";

import { getReviews, moderateReview } from "@/lib/api";

export const ReviewManagement = () => {
  const { token } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["reviews", token],
    queryFn: ({ signal }) => getReviews(token!, signal),
  });
  const mutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      moderateReview(token!, id, published),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["reviews", token] }),
        client.invalidateQueries({ queryKey: ["public-reviews"] }),
      ]);
    },
  });
  return (
    <SectionCard>
      <h2 className="font-semibold">Модерация отзывов</h2>
      <div className="mt-4 grid gap-3">
        {(query.data?.reviews ?? []).map((review) => (
          <article
            key={review.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium">
                {review.rating}/5 · {review.customer?.displayName ?? "Клиент"}
              </p>
              <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
                {review.comment}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {review.order.deviceType} · {new Date(review.createdAt).toLocaleDateString("ru-RU")}
              </p>
              {review.imageObjectId && (
                <ProtectedImage
                  objectId={review.imageObjectId}
                  alt="Фотография к отзыву"
                  className="mt-3 max-h-48 rounded-lg object-cover"
                />
              )}
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                {review.isPublished ? "Опубликован на главной и в новостях" : "Ожидает модерации"}
              </p>
              <ReviewShowcaseImages review={review} />
            </div>
            <button
              type="button"
              onClick={() => mutation.mutate({ id: review.id, published: !review.isPublished })}
              aria-label={review.isPublished ? "Скрыть отзыв" : "Опубликовать отзыв"}
              title={review.isPublished ? "Скрыть" : "Опубликовать"}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {review.isPublished ? (
                <Lock size={16} aria-hidden="true" />
              ) : (
                <Unlock size={16} aria-hidden="true" />
              )}
            </button>
          </article>
        ))}
        {!query.isLoading && (query.data?.reviews.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500">Отзывы пока не поступали.</p>
        )}
      </div>
    </SectionCard>
  );
};
