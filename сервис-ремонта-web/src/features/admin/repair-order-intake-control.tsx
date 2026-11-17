import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getRepairOrderIntake, updateRepairOrderIntake } from "@/lib/api";

const queryKey = ["repair-order-intake"] as const;

export const RepairOrderIntakeControl = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getRepairOrderIntake(signal),
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: (acceptingNewOrders: boolean) =>
      updateRepairOrderIntake(token!, acceptingNewOrders),
    onSuccess: async (settings) => {
      queryClient.setQueryData(queryKey, settings);
      await queryClient.invalidateQueries({ queryKey });
      toast.success(
        settings.acceptingNewOrders
          ? "Приём новых заявок включён."
          : "Приём новых заявок приостановлен.",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить приём заявок."),
  });
  const acceptingNewOrders = query.data?.acceptingNewOrders;

  return (
    <SectionCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold">Приём новых заявок</h2>
          <p className="mt-1 text-sm text-slate-500">
            {acceptingNewOrders === false
              ? "Новые заявки клиентов приостановлены. Текущие заказы и создание заявок администратором доступны."
              : "Когда приём выключен, клиенты не смогут отправить новую заявку; текущие заказы останутся доступны."}
          </p>
          {query.isError && (
            <div
              role="alert"
              className="mt-2 flex flex-wrap items-center gap-3 text-sm text-rose-600"
            >
              <span>Не удалось загрузить настройку.</span>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="font-semibold underline underline-offset-4"
              >
                Повторить загрузку
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={acceptingNewOrders === true}
          aria-label="Принимать новые заявки"
          disabled={acceptingNewOrders === undefined || mutation.isPending || query.isError}
          onClick={() => acceptingNewOrders !== undefined && mutation.mutate(!acceptingNewOrders)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            acceptingNewOrders ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-600"
          }`}
        >
          <span
            className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
              acceptingNewOrders ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {query.isLoading
          ? "Загружаем настройку…"
          : mutation.isPending
            ? "Сохраняем…"
            : acceptingNewOrders === true
              ? "Сейчас заявки принимаются."
              : acceptingNewOrders === false
                ? "Сейчас новые заявки не принимаются."
                : "Настройка недоступна."}
      </p>
    </SectionCard>
  );
};
