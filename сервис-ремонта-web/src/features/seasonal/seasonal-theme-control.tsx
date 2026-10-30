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

const seasonOptions: {
  season: SeasonalSeason;
  label: string;
  description: string;
  icon: typeof Leaf;
}[] = [
  {
    season: "SPRING",
    label: "Весна",
    description: "Свежие краски и весенние лепестки.",
    icon: Leaf,
  },
  { season: "SUMMER", label: "Лето", description: "Тёплая палитра и солнечные блики.", icon: Sun },
  {
    season: "AUTUMN",
    label: "Осень",
    description: "Осенние листья и мягкий дождь.",
    icon: CloudSun,
  },
  { season: "WINTER", label: "Зима", description: "Зимний фон и падающий снег.", icon: Snowflake },
];

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

  return (
    <div className="grid gap-4">
      <SectionCard className="border-blue-100 bg-gradient-to-r from-white to-blue-50/80 dark:border-[#304373] dark:from-[#0b1428] dark:to-[#111d3a]">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-700 uppercase dark:text-[#9aeeff]">
          Настройки сервиса
        </p>
        <h2 className="mt-1 text-lg font-semibold">Сезонное оформление</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300" aria-live="polite">
          {state
            ? state.activeSeason === "NONE"
              ? "Сезонное оформление выключено."
              : `Включено оформление «${seasonLabels[state.activeSeason]}».`
            : theme.isPending
              ? "Загружаем настройки сезонного оформления…"
              : "Выберите оформление для сайта и Android."}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Администратор может выбрать любой сезон в любое время, независимо от даты. Включение
          нового варианта отключает предыдущий; настройка сохраняется до следующего изменения.
        </p>
      </SectionCard>

      {theme.isError && !state && (
        <SectionCard>
          <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">
            Не удалось загрузить настройки. Проверьте подключение и попробуйте ещё раз.
          </p>
          <button
            type="button"
            disabled={theme.isFetching}
            onClick={() => void theme.refetch()}
            className="mt-3 min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 dark:border-[#304373] dark:text-slate-200 dark:hover:bg-[#152449]"
          >
            Повторить загрузку
          </button>
        </SectionCard>
      )}

      {state && (
        <div className="grid gap-3 sm:grid-cols-2">
          {seasonOptions.map(({ season, label, description, icon: Icon }) => {
            const isActive = state.activeSeason === season;

            return (
              <SectionCard key={season} className="border-slate-200/80 dark:border-[#26365f]">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    aria-label={`${label}: ${isActive ? "выключить" : "включить"} сезонное оформление`}
                    disabled={changeTheme.isPending || theme.isFetching}
                    onClick={() => changeTheme.mutate(isActive ? "NONE" : season)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive
                        ? "border-blue-700 bg-blue-600 dark:border-cyan-300 dark:bg-cyan-500"
                        : "border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`}
                    />
                    {changeTheme.isPending && (
                      <LoaderCircle
                        size={13}
                        className="absolute inset-0 m-auto animate-spin text-slate-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
                <h3 className="mt-4 font-semibold">{label}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isActive ? "Включено" : "Выключено"}
                </p>
              </SectionCard>
            );
          })}
        </div>
      )}

      {theme.isError && state && (
        <p className="text-sm text-rose-700 dark:text-rose-300" role="status">
          Не удалось обновить настройки. Показан последний сохранённый выбор.
        </p>
      )}
    </div>
  );
};
