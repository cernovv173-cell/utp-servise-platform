import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudSun, Leaf, LoaderCircle, Snowflake, Sun } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { seasonalThemeQueryKey, useSeasonalTheme } from "@/features/seasonal/use-seasonal-theme";

import { type SeasonalSeason, type SeasonalSeasonChoice, setSeasonalTheme } from "@/lib/api";

const seasonLabels: Record<SeasonalSeason, string> = {
  SPRING: "Весна",
  SUMMER: "Лето",
  AUTUMN: "Осень",
  WINTER: "Зима",
};

const seasonIcons = {
  SPRING: Leaf,
  SUMMER: Sun,
  AUTUMN: CloudSun,
  WINTER: Snowflake,
} satisfies Record<SeasonalSeason, typeof Leaf>;

const formatCalendarDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export const SeasonalThemeControl = ({ token }: { token: string }) => {
  const queryClient = useQueryClient();
  const theme = useSeasonalTheme();
  const changeTheme = useMutation({
    mutationFn: (season: SeasonalSeasonChoice) => setSeasonalTheme(token, season),
    onSuccess: (state) => {
      queryClient.setQueryData(seasonalThemeQueryKey, state);
      toast.success(
        state.activeSeason === "NONE"
          ? "Сезонное оформление отключено."
          : `Оформление «${seasonLabels[state.activeSeason]}» включено.`,
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить оформление."),
  });

  const state = theme.data;
  const isActive = Boolean(state && state.activeSeason === state.calendarSeason);
  const SeasonIcon = state ? seasonIcons[state.calendarSeason] : Leaf;

  return (
    <SectionCard className="mb-6 border-blue-100 bg-gradient-to-r from-white to-blue-50/80 dark:border-[#304373] dark:from-[#0b1428] dark:to-[#111d3a]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-[#17264b] dark:text-[#9aeeff]">
            <SeasonIcon size={24} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase dark:text-[#9aeeff]">
              Для администратора
            </p>
            <h2 className="mt-1 text-lg font-semibold">Сезонное оформление</h2>
            {theme.isPending && (
              <p className="mt-1 text-sm text-slate-500">Проверяем календарь сезонов…</p>
            )}
            {theme.isError && !state && (
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300" role="status">
                Не удалось загрузить настройки. Проверьте подключение и попробуйте ещё раз.
              </p>
            )}
            {state && (
              <>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
                  {isActive
                    ? `Сейчас действует оформление «${seasonLabels[state.calendarSeason]}» на сайте и в Android.`
                    : `Оформление выключено. Сейчас календарный сезон — ${seasonLabels[state.calendarSeason].toLowerCase()}.`}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Следующий сезон: {seasonLabels[state.nextSeason]} —{" "}
                  {formatCalendarDate(state.nextSeasonStartsOn)}. Включить можно только в его сезон.
                </p>
              </>
            )}
          </div>
        </div>
        {state ? (
          <button
            type="button"
            disabled={changeTheme.isPending || theme.isFetching}
            onClick={() => changeTheme.mutate(isActive ? "NONE" : state.calendarSeason)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changeTheme.isPending ? (
              <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
            ) : (
              <SeasonIcon size={17} aria-hidden="true" />
            )}
            {isActive ? "Отключить оформление" : `Включить «${seasonLabels[state.calendarSeason]}»`}
          </button>
        ) : (
          <button
            type="button"
            disabled={theme.isFetching}
            onClick={() => void theme.refetch()}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:border-[#304373] dark:text-slate-200 dark:hover:bg-[#152449]"
          >
            Повторить загрузку
          </button>
        )}
      </div>
    </SectionCard>
  );
};
