import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";
import { ProtectedMedia } from "@/components/protected-media";

import { NewsAdmin } from "@/features/admin/news-admin";
import { useAuth } from "@/features/auth/auth-context";
import { CampaignPlacement } from "@/features/campaigns/campaign-banner";
import { BirthdayGreetingCard } from "@/features/news/birthday-greeting-card";
import { TechnologyFactCard } from "@/features/news/technology-fact-card";
import { getNewsWithNextTechnologyFact } from "@/features/news/technology-fact-query";

const NewsPage = () => {
  const { token, user } = useAuth();
  const query = useQuery({
    queryKey: ["news", token],
    queryFn: ({ signal }) => getNewsWithNextTechnologyFact(token!, signal),
    enabled: Boolean(token),
    refetchOnMount: "always",
    refetchInterval: (currentQuery) => {
      const nextUpdateAt = currentQuery.state.data?.technologyFact?.nextUpdateAt;
      if (!nextUpdateAt) return false;
      return Math.max(1_000, Date.parse(nextUpdateAt) - Date.now());
    },
    refetchOnWindowFocus: true,
  });
  const publishedReviews = (query.data?.reviews ?? []).filter((review) => review.isPublished);
  return (
    <AppShell active="/news">
      <PageTitle
        eyebrow="ОБНОВЛЕНИЯ"
        title="Новости сервиса"
        description="Объявления и актуальные предложения ЕНОТ СЕРВИС."
      />
      {user?.role === "ADMIN" && <NewsAdmin />}
      {query.isLoading && <p className="text-sm text-slate-500">Загружаем новости…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить новости.
        </p>
      )}
      <CampaignPlacement placement="NEWS" className="mb-5" />
      {query.data?.birthdayGreeting && (
        <BirthdayGreetingCard greeting={query.data.birthdayGreeting} />
      )}
      {query.data?.technologyFact && <TechnologyFactCard fact={query.data.technologyFact} />}
      <div className="grid gap-4 md:grid-cols-2">
        {(query.data?.articles ?? [])
          .filter((item) => item.isPublished)
          .map((item) => (
            <SectionCard
              key={item.id}
              className={item.isFeatured ? "border-blue-200 dark:border-blue-900" : ""}
            >
              {(item.imageObjectId || item.videoObjectId) && (
                <ProtectedMedia
                  objectId={item.videoObjectId || item.imageObjectId}
                  alt={item.title}
                  className="mb-4 max-h-80 w-full rounded-xl object-contain"
                />
              )}
              {item.isFeatured && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  На главной
                </span>
              )}
              <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-600 dark:text-slate-300">
                {item.content}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                {item.startsAt
                  ? `С ${new Date(item.startsAt).toLocaleString("ru-RU")}`
                  : item.publishedAt
                    ? new Date(item.publishedAt).toLocaleDateString("ru-RU")
                    : ""}
                {item.endsAt ? ` · до ${new Date(item.endsAt).toLocaleString("ru-RU")}` : ""}
              </p>
            </SectionCard>
          ))}
        {publishedReviews.map((review) => (
          <SectionCard key={`review-${review.id}`}>
            {review.imageObjectId && (
              <ProtectedImage
                objectId={review.imageObjectId}
                alt="Фотография к отзыву"
                loading="lazy"
                className="mb-4 max-h-56 w-full rounded-xl object-cover"
              />
            )}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Отзыв клиента</h2>
              <span className="text-sm font-semibold text-amber-600">★ {review.rating}/5</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {review.customer?.displayName ?? "Клиент"} ·{" "}
              {new Date(review.createdAt).toLocaleDateString("ru-RU")}
            </p>
            <p className="mt-3 text-sm leading-6 whitespace-pre-line text-slate-600 dark:text-slate-300">
              {review.comment}
            </p>
          </SectionCard>
        ))}
        {!query.isLoading &&
          !query.isError &&
          (query.data?.articles ?? []).filter((item) => item.isPublished).length === 0 &&
          publishedReviews.length === 0 &&
          !query.data?.birthdayGreeting && (
            <SectionCard className="md:col-span-2">
              <p className="text-sm text-slate-500">
                Сейчас нет опубликованных новостей и отзывов.
              </p>
            </SectionCard>
          )}
      </div>
    </AppShell>
  );
};
export const Route = createFileRoute("/news")({ component: NewsPage });
