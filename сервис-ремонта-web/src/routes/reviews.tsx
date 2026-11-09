import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { PublicSiteShell } from "@/components/public-site-shell";

import { ReviewManagement } from "@/features/admin/review-management";
import { useAuth } from "@/features/auth/auth-context";
import { BenefitsNavigation } from "@/features/navigation/benefits-navigation";

import { getPublicReviewImageUrl, getPublicReviews } from "@/lib/api";
import { createPageHead } from "@/lib/seo";

const ReviewsPage = () => {
  const { ready, user } = useAuth();
  const query = useQuery({
    queryKey: ["public-reviews"],
    queryFn: ({ signal }) => getPublicReviews(signal),
    staleTime: 60_000,
  });
  if (!ready)
    return <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем…</div>;
  const content = (
    <>
      {user?.role === "CUSTOMER" && <BenefitsNavigation />}
      <PageTitle
        eyebrow="ОТЗЫВЫ"
        title="Отзывы клиентов"
        description="Только отзывы о завершённых ремонтах, опубликованные сервисом."
      />
      {user?.role === "ADMIN" && <ReviewManagement />}
      <div className="grid gap-4 md:grid-cols-2">
        {(query.data?.reviews ?? []).map((review) => (
          <SectionCard key={review.id}>
            {review.hasWorkPhoto && (
              <img
                src={getPublicReviewImageUrl(review.id, "work")}
                alt="Фото выполненной ремонтной работы"
                loading="lazy"
                className="mb-4 max-h-64 w-full rounded-xl object-cover"
              />
            )}
            <div className="flex gap-1 text-amber-500" aria-label={`Оценка ${review.rating} из 5`}>
              {Array.from({ length: review.rating }, (_, index) => (
                <Star key={index} size={16} fill="currentColor" aria-hidden="true" />
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 whitespace-pre-line">{review.comment}</p>
            <p className="mt-4 text-xs text-slate-400">
              {review.customer.displayName} · {review.order.deviceType} ·{" "}
              {new Date(review.createdAt).toLocaleDateString("ru-RU")}
            </p>
          </SectionCard>
        ))}
        {!query.isLoading && !query.isError && (query.data?.reviews.length ?? 0) === 0 && (
          <SectionCard className="md:col-span-2">
            <p className="text-sm text-slate-500">Опубликованных отзывов пока нет.</p>
          </SectionCard>
        )}
      </div>
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить отзывы.
        </p>
      )}
    </>
  );
  return user ? (
    <AppShell active="/reviews">{content}</AppShell>
  ) : (
    <PublicSiteShell>{content}</PublicSiteShell>
  );
};
export const Route = createFileRoute("/reviews")({
  component: ReviewsPage,
  head: () =>
    createPageHead({
      title: "Отзывы о ремонте техники — ЕНОТ СЕРВИС, Пушкино",
      description:
        "Отзывы клиентов сервисного центра ЕНОТ СЕРВИС в Пушкино: ремонт ноутбуков, компьютеров, телефонов и планшетов, сроки и качество обслуживания.",
      path: "/reviews",
    }),
});
