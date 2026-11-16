import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { PublicSiteShell } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getPublicWorkStories, getPublicWorkStoryImageUrl } from "@/lib/api";
import { createPageHead } from "@/lib/seo";

const WorkStoriesPage = () => {
  const { ready, user } = useAuth();
  const query = useQuery({
    queryKey: ["public-work-stories"],
    queryFn: ({ signal }) => getPublicWorkStories(signal),
    staleTime: 60_000,
  });

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем…</div>;
  }

  const content = (
    <>
      <PageTitle
        eyebrow="ПРАКТИКА СЕРВИСА"
        title="Примеры работ"
        description="Истории подготовлены самим сервисом. Это описание выполненных работ, а не отзывы клиентов."
      />
      {user?.role === "ADMIN" && (
        <Link
          to="/news"
          className="mb-5 inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          Управлять публикациями
        </Link>
      )}
      {query.isLoading && <p className="text-sm text-slate-500">Загружаем примеры работ…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить примеры работ.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(query.data?.stories ?? []).map((story) => (
          <SectionCard key={story.id}>
            {story.hasImage && (
              <img
                src={getPublicWorkStoryImageUrl(story.id)}
                alt={`Фото к примеру работы: ${story.title}`}
                loading="lazy"
                className="mb-4 aspect-[16/10] w-full rounded-xl bg-slate-100 object-cover dark:bg-slate-900"
              />
            )}
            <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
              <Wrench size={13} aria-hidden="true" /> Пример работы от сервиса
            </p>
            <h2 className="mt-3 text-lg font-semibold">{story.title}</h2>
            <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-600 dark:text-slate-300">
              {story.content}
            </p>
            {story.publishedAt && (
              <time dateTime={story.publishedAt} className="mt-4 block text-xs text-slate-400">
                {new Date(story.publishedAt).toLocaleDateString("ru-RU")}
              </time>
            )}
          </SectionCard>
        ))}
        {!query.isLoading && !query.isError && (query.data?.stories.length ?? 0) === 0 && (
          <SectionCard className="md:col-span-2 xl:col-span-3">
            <p className="text-sm text-slate-500">
              Пока нет опубликованных примеров. Сервис добавит их сюда после подготовки описания.
            </p>
          </SectionCard>
        )}
      </div>
    </>
  );

  return user ? (
    <AppShell active="/work-stories">{content}</AppShell>
  ) : (
    <PublicSiteShell>{content}</PublicSiteShell>
  );
};

export const Route = createFileRoute("/work-stories")({
  component: WorkStoriesPage,
  head: () =>
    createPageHead({
      title: "Примеры работ — ЕНОТ СЕРВИС, Пушкино",
      description:
        "Истории о работе сервиса по ремонту компьютеров и ноутбуков. Примеры работ отделены от отзывов клиентов.",
      path: "/work-stories",
    }),
});
