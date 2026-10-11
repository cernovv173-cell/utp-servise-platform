import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateRepairPriority } from "@/lib/api";

export const RepairOrderPriority = ({
  orderId,
  priority,
  token,
  canEdit = false,
}: {
  orderId: string;
  priority: "NORMAL" | "URGENT" | undefined;
  token: string;
  canEdit?: boolean;
}) => {
  const queryClient = useQueryClient();
  const currentPriority = priority ?? "NORMAL";
  const mutation = useMutation({
    mutationFn: () =>
      updateRepairPriority(token, orderId, currentPriority === "URGENT" ? "NORMAL" : "URGENT"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", token] }),
        queryClient.invalidateQueries({ queryKey: ["order-search", token] }),
        queryClient.invalidateQueries({ queryKey: ["repair-schedule", token] }),
      ]);
      toast.success("Приоритет заявки обновлён.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить приоритет."),
  });

  const isUrgent = currentPriority === "URGENT";
  const className = isUrgent
    ? "rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
    : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  if (!canEdit) {
    return <span className={className}>{isUrgent ? "Срочно" : "Обычный приоритет"}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      aria-label={`Изменить приоритет: сейчас ${isUrgent ? "срочный" : "обычный"}`}
    >
      {mutation.isPending ? "Сохраняем…" : isUrgent ? "Срочно · снять" : "Обычный · повысить"}
    </button>
  );
};
