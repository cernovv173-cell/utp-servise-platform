import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "@/components/app-shell";

import type { NewsArticle } from "@/lib/api";

export const FeaturedNewsCarousel = ({
  articles,
  isLoading,
  isError,
}: {
  articles: NewsArticle[];
  isLoading: boolean;
  isError: boolean;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isAutoPaused = isPaused || isHovered || isFocused;
  const activeIndex = articles.length ? currentIndex % articles.length : 0;
  const article = articles[activeIndex];

  useEffect(() => {
    if (isAutoPaused || articles.length < 2) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % articles.length);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [articles.length, isAutoPaused]);

  return (
    <section
      className="mb-6"
      aria-label="Приоритетные новости"
      aria-roledescription="карусель"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Приоритетные новости</h2>
        <div className="flex items-center gap-2">
          <Link to="/news" className="text-sm font-semibold text-blue-600">
            Все новости <span aria-hidden="true">→</span>
          </Link>
          {articles.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Предыдущая новость"
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() =>
                  setCurrentIndex((index) => (index - 1 + articles.length) % articles.length)
                }
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                aria-label={isPaused ? "Продолжить смену новостей" : "Приостановить смену новостей"}
                aria-pressed={isPaused}
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => setIsPaused((paused) => !paused)}
              >
                {isPaused ? <Play size={15} /> : <Pause size={15} />}
              </button>
              <button
                type="button"
                aria-label="Следующая новость"
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => setCurrentIndex((index) => (index + 1) % articles.length)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
      {isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить новости.
        </p>
      )}
      {isLoading && <p className="text-sm text-slate-500">Загружаем новости…</p>}
      {!isLoading && articles.length === 0 && (
        <SectionCard>
          <p className="text-sm text-slate-500">Пока нет приоритетных новостей.</p>
        </SectionCard>
      )}
      {article && (
        <div
          role="group"
          aria-roledescription="слайд"
          aria-label={`Новость ${activeIndex + 1} из ${articles.length}`}
          aria-live={isAutoPaused ? "polite" : "off"}
        >
          <SectionCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs font-semibold text-blue-600">Главная новость</p>
              {articles.length > 1 && (
                <span aria-hidden="true" className="text-xs text-slate-500 tabular-nums">
                  {activeIndex + 1} / {articles.length}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-semibold">{article.title}</h3>
            <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-500">{article.content}</p>
          </SectionCard>
        </div>
      )}
    </section>
  );
};
