import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import { FlowingFireFrame } from "@/components/flowing-fire-frame";
import { Select } from "@/components/select";

import { useAuth } from "@/features/auth/auth-context";
import { FLOWING_FIRE_PALETTE_OPTIONS } from "@/features/visual-effects/flowing-fire-palettes";
import {
  FLOWING_FIRE_SETTINGS_QUERY_KEY,
  useFlowingFireSettings,
} from "@/features/visual-effects/use-flowing-fire-settings";

import { type FlowingFireSettings, updateFlowingFireSettings } from "@/lib/api";

const effectSections = [
  {
    key: "closure",
    title: "Объявление о перерыве",
    description: "Огненная рамка вокруг объявления на главной странице.",
    preview: "Объявление сервиса",
  },
  {
    key: "giveaway",
    title: "Карточки розыгрышей",
    description: "Оформление активных розыгрышей отдельно от обычных акций.",
    preview: "Розыгрыш",
  },
] as const;

export const FlowingFireSettingsControl = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const query = useFlowingFireSettings();
  const [form, setForm] = useState<FlowingFireSettings | null>(null);
  const settings = form ?? query.data ?? null;

  const mutation = useMutation({
    mutationFn: (next: FlowingFireSettings) => updateFlowingFireSettings(token!, next),
    onSuccess: async (next) => {
      setForm(next);
      queryClient.setQueryData(FLOWING_FIRE_SETTINGS_QUERY_KEY, next);
      await queryClient.invalidateQueries({ queryKey: FLOWING_FIRE_SETTINGS_QUERY_KEY });
      toast.success("Настройки цветных рамок сохранены.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки."),
  });

  const update = (
    section: keyof FlowingFireSettings,
    patch: Partial<FlowingFireSettings[typeof section]>,
  ) => {
    if (!settings) return;
    mutation.mutate({
      ...settings,
      [section]: { ...settings[section], ...patch },
    });
  };

  return (
    <SectionCard>
      <div>
        <h2 className="font-semibold">Цветные анимированные рамки</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Независимо включайте эффект для объявления и розыгрышей и выбирайте для каждого свой цвет.
          Изменения сохраняются сразу.
        </p>
      </div>

      {query.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем настройки…</p>}
      {query.isError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-rose-600">
          <span>Не удалось загрузить настройки рамок.</span>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="font-semibold underline underline-offset-4"
          >
            Повторить загрузку
          </button>
        </div>
      )}

      {settings && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {effectSections.map(({ key, title, description, preview }) => {
            const effect = settings[key];
            return (
              <div
                key={key}
                className="grid content-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={effect.enabled}
                    aria-label={`Включить рамку: ${title}`}
                    disabled={mutation.isPending || query.isError}
                    onClick={() => update(key, { enabled: !effect.enabled })}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      effect.enabled ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        effect.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <label className="grid gap-1.5 text-sm font-medium">
                  Цветовая палитра
                  <Select
                    ariaLabel={`Цветовая палитра: ${title}`}
                    className="dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    contentClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    disabled={mutation.isPending || query.isError}
                    options={FLOWING_FIRE_PALETTE_OPTIONS}
                    value={effect.palette}
                    onValueChange={(value) => {
                      const palette = FLOWING_FIRE_PALETTE_OPTIONS.find(
                        (option) => option.value === value,
                      )?.value;
                      if (palette) update(key, { palette });
                    }}
                  />
                </label>

                <FlowingFireFrame
                  enabled={effect.enabled}
                  palette={effect.palette}
                  borderRadius="0.85rem"
                >
                  <div className="rounded-xl bg-slate-950 px-3 py-3 text-center text-xs font-semibold text-white">
                    Предпросмотр: {preview}
                  </div>
                </FlowingFireFrame>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-400">
        {mutation.isPending
          ? "Сохраняем…"
          : settings
            ? `Объявление: ${settings.closure.enabled ? "включено" : "выключено"}; розыгрыши: ${settings.giveaway.enabled ? "включены" : "выключены"}.`
            : query.isError
              ? "Настройки недоступны."
              : ""}
      </p>
    </SectionCard>
  );
};
