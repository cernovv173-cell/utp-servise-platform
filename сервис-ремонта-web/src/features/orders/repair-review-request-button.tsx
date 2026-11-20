import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { requestRepairOrderReview } from "@/lib/api";
import type { RepairOrder } from "@/lib/api";

type RepairReviewRequestButtonProps = {
  order: RepairOrder;
  token: string;
};

export const RepairReviewRequestButton = ({ order, token }: RepairReviewRequestButtonProps) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => requestRepairOrderReview(token, order.id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", token] }),
        queryClient.invalidateQueries({ queryKey: ["order-search", token] }),
      ]);

      if (result.alreadyRequested) {
        toast.message("Запрос на отзыв уже был отправлен ранее.");
      } else if (result.notificationSent === false) {
        toast.message("Запрос сохранён. Клиент увидит его в заказе.");
      } else {
        toast.success("Запрос отзыва отправлен клиенту.");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить запрос отзыва.");
    },
  });
  const isRequested = Boolean(order.reviewRequestedAt || mutation.data?.reviewRequestedAt);
  const notificationFailed =
    !mutation.data?.alreadyRequested && mutation.data?.notificationSent === false;

  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        disabled={isRequested || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending
          ? "Отправка запроса…"
          : isRequested
            ? "Запрос уже отправлен"
            : "Запросить отзыв"}
      </button>
      {notificationFailed && (
        <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
          Push не доставлен; просьба об отзыве сохранена в заказе клиента.
        </p>
      )}
    </div>
  );
};
