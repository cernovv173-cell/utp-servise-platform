import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CUSTOMER_CATALOG_VISIBILITY_QUERY_KEY } from "@/features/catalog/catalog-visibility";

import {
  type CatalogVisibilitySettings,
  getCatalogVisibility,
  updateCatalogVisibility,
} from "@/lib/api";

const switches: Array<{
  key: keyof CatalogVisibilitySettings;
  label: string;
  description: string;
}> = [
  {
    key: "servicesVisible",
    label: "Каталог услуг и цены",
    description: "Прайс будет отображаться на сайте и в клиентской части приложения.",
  },
  {
    key: "productsVisible",
    label: "Обычные товары в магазине",
    description: "Управляет товарами из каталога; изделия ручной работы остаются отдельно.",
  },
];

export const CatalogVisibilityControl = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CUSTOMER_CATALOG_VISIBILITY_QUERY_KEY,
    queryFn: ({ signal }) => getCatalogVisibility(signal),
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (settings: CatalogVisibilitySettings) => updateCatalogVisibility(token!, settings),
    onSuccess: async (settings) => {
      queryClient.setQueryData(CUSTOMER_CATALOG_VISIBILITY_QUERY_KEY, settings);
      await queryClient.invalidateQueries({
        queryKey: CUSTOMER_CATALOG_VISIBILITY_QUERY_KEY,
      });
      toast.success("Видимость каталога обновлена.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Не удалось изменить видимость каталога.",
      ),
  });

  const settings = query.data;

  return (
    <SectionCard>
      <div>
        <h2 className="font-semibold">Каталог для клиентов</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Временно скрывайте отдельные разделы сайта и приложения. Позиции каталога, складские
          остатки, уже оформленные заказы, сметы и акты не удаляются и не меняются.
        </p>
      </div>

      {query.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем настройки…</p>}
      {query.isError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-rose-600">
          <span>Не удалось загрузить настройки каталога.</span>
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
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {switches.map(({ key, label, description }) => {
            const checked = settings[key];
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0"
              >
                <div className="max-w-2xl">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={label}
                  disabled={mutation.isPending || query.isError}
                  onClick={() => mutation.mutate({ ...settings, [key]: !checked })}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    checked ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      checked ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        {mutation.isPending
          ? "Сохраняем…"
          : settings
            ? "Изменения сохраняются сразу после переключения."
            : query.isError
              ? "Настройка недоступна."
              : ""}
      </p>
    </SectionCard>
  );
};
