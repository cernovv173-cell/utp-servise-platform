import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getNews } from "@/lib/api";

const NewsPage = () => {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["news", token],
    queryFn: ({ signal }) => getNews(token!, signal),
    enabled: Boolean(token),
  });
  return (
    <AppShell active="/news">
      <PageTitle
        eyebrow="ОБНОВЛЕНИЯ"
        title="Новости сервиса"
        description="Объявления и актуальные предложения UTP Servise."
      />
      {query.isLoading && <p className="text-sm text-slate-500">Загружаем новости…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить новости.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(query.data?.articles ?? [])
          .filter((item) => item.isPublished)
          .map((item) => (
            <SectionCard
              key={item.id}
              className={item.isFeatured ? "border-blue-200 dark:border-blue-900" : ""}
            >
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
        {!query.isLoading &&
          !query.isError &&
          (query.data?.articles ?? []).filter((item) => item.isPublished).length === 0 && (
            <SectionCard className="md:col-span-2">
              <p className="text-sm text-slate-500">Сейчас нет опубликованных новостей.</p>
            </SectionCard>
          )}
      </div>
    </AppShell>
  );
};
export const Route = createFileRoute("/news")({ component: NewsPage });
