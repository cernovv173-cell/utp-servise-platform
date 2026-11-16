import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Wrench } from "lucide-react";

import { getPublicWorkStories, getPublicWorkStoryImageUrl } from "@/lib/api";

export const HomeWorkStoriesShowcase = () => {
  const query = useQuery({
    queryKey: ["public-work-stories"],
    queryFn: ({ signal }) => getPublicWorkStories(signal),
    staleTime: 60_000,
  });
  const stories = query.data?.stories ?? [];

  if (query.isLoading || query.isError || stories.length === 0) return null;

  return (
    <section
      className="mx-auto max-w-7xl px-4 py-12 md:px-8"
      aria-labelledby="home-work-stories-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Практика сервиса
          </p>
          <h2 id="home-work-stories-title" className="mt-3 text-3xl font-semibold tracking-tight">
            Примеры работ
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Истории подготовлены сервисом и не являются отзывами клиентов.
          </p>
        </div>
        <Link
          to="/work-stories"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#304373] dark:text-[#d5def6] dark:hover:bg-[#152449]"
        >
          Все примеры <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stories.slice(0, 3).map((story) => (
          <article
            key={story.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/85"
          >
            {story.hasImage && (
              <img
                src={getPublicWorkStoryImageUrl(story.id)}
                alt={`Фото к примеру работы: ${story.title}`}
                loading="lazy"
                className="aspect-[16/10] w-full bg-slate-100 object-cover dark:bg-slate-900"
              />
            )}
            <div className="p-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                <Wrench size={13} aria-hidden="true" /> Пример работы от сервиса
              </span>
              <h3 className="mt-3 text-lg font-semibold">{story.title}</h3>
              <p className="mt-2 line-clamp-4 text-sm leading-6 whitespace-pre-line text-slate-600 dark:text-slate-300">
                {story.content}
              </p>
              {story.publishedAt && (
                <time dateTime={story.publishedAt} className="mt-4 block text-xs text-slate-400">
                  {new Date(story.publishedAt).toLocaleDateString("ru-RU")}
                </time>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
