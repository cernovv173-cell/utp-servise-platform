import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CLOSURE_ANNOUNCEMENT_QUERY_KEY } from "@/features/holiday/holiday-closure";

import {
  type ClosureAnnouncementSettings,
  getClosureAnnouncement,
  updateClosureAnnouncement,
} from "@/lib/api";

const fieldClassName =
  "min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950";

export const ClosureAnnouncementControl = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CLOSURE_ANNOUNCEMENT_QUERY_KEY,
    queryFn: ({ signal }) => getClosureAnnouncement(signal),
    staleTime: 0,
  });
  const [form, setForm] = useState<ClosureAnnouncementSettings | null>(null);
  const currentSettings = form ?? query.data ?? null;

  const mutation = useMutation({
    mutationFn: (settings: ClosureAnnouncementSettings) =>
      updateClosureAnnouncement(token!, settings),
    onSuccess: async (settings) => {
      setForm(settings);
      queryClient.setQueryData(CLOSURE_ANNOUNCEMENT_QUERY_KEY, settings);
      await queryClient.invalidateQueries({ queryKey: CLOSURE_ANNOUNCEMENT_QUERY_KEY });
      toast.success("Объявление о графике работы сохранено.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить объявление."),
  });

  const update = <K extends keyof ClosureAnnouncementSettings>(
    key: K,
    value: ClosureAnnouncementSettings[K],
  ) =>
    setForm((current) => {
      const source = current ?? query.data;
      return source ? { ...source, [key]: value } : current;
    });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentSettings) mutation.mutate(currentSettings);
  };

  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold">Объявление о перерыве в работе</h2>
          <p className="mt-1 text-sm text-slate-500">
            Настройте текст, даты, время открытия и телефон для срочных заказов. Объявление
            показывается только в заданный период и само скрывается после открытия.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={currentSettings?.enabled ?? false}
          aria-label="Показывать объявление о перерыве"
          disabled={!currentSettings || mutation.isPending || query.isError}
          onClick={() => currentSettings && update("enabled", !currentSettings.enabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            currentSettings?.enabled ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-600"
          }`}
        >
          <span
            className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
              currentSettings?.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {query.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем настройки…</p>}
      {query.isError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-rose-600">
          <span>Не удалось загрузить объявление.</span>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="font-semibold underline underline-offset-4"
          >
            Повторить загрузку
          </button>
        </div>
      )}

      {currentSettings && (
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Заголовок
            <input
              required
              maxLength={120}
              value={currentSettings.title}
              onChange={(event) => update("title", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Основной текст
            <textarea
              required
              rows={2}
              maxLength={1000}
              value={currentSettings.message}
              onChange={(event) => update("message", event.target.value)}
              className={`${fieldClassName} resize-y`}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Первый день закрытия
            <input
              required
              type="date"
              value={currentSettings.startDate}
              onChange={(event) => update("startDate", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Последний день закрытия (включительно)
            <input
              required
              type="date"
              min={currentSettings.startDate}
              value={currentSettings.endDate}
              onChange={(event) => update("endDate", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Время открытия по Москве
            <input
              required
              type="time"
              value={currentSettings.reopenTime}
              onChange={(event) => update("reopenTime", event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Телефон для срочных заказов
            <input
              type="tel"
              maxLength={32}
              value={currentSettings.phoneNumber}
              onChange={(event) => update("phoneNumber", event.target.value)}
              placeholder="Пусто — использовать телефон компании"
              className={fieldClassName}
            />
          </label>
          <p className="text-xs text-slate-500 md:col-span-2">
            Этот переключатель управляет только объявлением. Приём заявок включается отдельно в
            настройке «Приём новых заявок».
          </p>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {mutation.isPending ? "Сохраняем…" : "Сохранить объявление"}
            </button>
            <span className="text-xs text-slate-500">
              {currentSettings.enabled ? "Объявление включено." : "Объявление выключено."}
            </span>
          </div>
        </form>
      )}
    </SectionCard>
  );
};
