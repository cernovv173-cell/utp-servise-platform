import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { getPublicReviewImageUrl, getPublicReviews } from "@/lib/api";

export const HomeReviewShowcase = () => {
  const query = useQuery({
    queryKey: ["public-reviews"],
    queryFn: ({ signal }) => getPublicReviews(signal),
    staleTime: 60_000,
  });
  const reviews = query.data?.reviews ?? [];

  if (query.isLoading || query.isError || reviews.length === 0) return null;

  return (
    <section
      id="reviews"
      className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 md:px-8"
      aria-labelledby="home-review-showcase-title"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
          После ремонта
        </p>
        <h2 id="home-review-showcase-title" className="mt-3 text-3xl font-semibold tracking-tight">
          Отзывы клиентов и результаты работ
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Здесь показаны только отзывы о завершённых ремонтах, опубликованные сервисом.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/85"
          >
            {review.hasWorkPhoto && (
              <img
                src={getPublicReviewImageUrl(review.id, "work")}
                alt="Фото выполненной ремонтной работы"
                loading="lazy"
                className="aspect-[16/10] w-full bg-slate-100 object-cover dark:bg-slate-900"
              />
            )}
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex items-center gap-1 text-amber-500"
                  aria-label={`Оценка ${review.rating} из 5`}
                >
                  {Array.from({ length: review.rating }, (_, index) => (
                    <Star key={index} size={15} fill="currentColor" aria-hidden="true" />
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {review.order.deviceType} ·{" "}
                  {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 whitespace-pre-line text-slate-600 dark:text-slate-300">
                {review.comment}
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                {review.hasClientPhoto && (
                  <img
                    src={getPublicReviewImageUrl(review.id, "client")}
                    alt={`Фото клиента ${review.customer.displayName}`}
                    loading="lazy"
                    className="size-12 rounded-full object-cover"
                  />
                )}
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {review.customer.displayName}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
