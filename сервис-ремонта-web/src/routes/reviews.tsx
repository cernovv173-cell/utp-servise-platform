import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getReviews } from "@/lib/api";

const ReviewsPage = () => {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["reviews", token],
    queryFn: ({ signal }) => getReviews(token!, signal),
    enabled: Boolean(token),
  });
  return (
    <AppShell active="/reviews">
      <PageTitle
        eyebrow="ОТЗЫВЫ"
        title="Отзывы"
        description="Отзывы клиентов о завершённых ремонтах."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(query.data?.reviews ?? []).map((review) => (
          <SectionCard key={review.id}>
            <div className="flex gap-1 text-amber-500" aria-label={`Оценка ${review.rating} из 5`}>
              {Array.from({ length: review.rating }, (_, index) => (
                <Star key={index} size={16} fill="currentColor" />
              ))}
            </div>
            <p className="mt-3 text-sm leading-6">{review.comment}</p>
            <p className="mt-4 text-xs text-slate-400">
              {review.customer?.displayName ?? "Клиент"} · {review.order.deviceType} ·{" "}
              {new Date(review.createdAt).toLocaleDateString("ru-RU")}
            </p>
          </SectionCard>
        ))}
        {!query.isLoading && !query.isError && (query.data?.reviews.length ?? 0) === 0 && (
          <SectionCard className="md:col-span-2">
            <p className="text-sm text-slate-500">Отзывов пока нет.</p>
          </SectionCard>
        )}
      </div>
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить отзывы.
        </p>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/reviews")({ component: ReviewsPage });
