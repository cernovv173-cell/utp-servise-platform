import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";

import {
  getRepairOrderChat,
  joinAdminToRepairOrderChat,
  markRepairOrderChatRead,
  requestRepairOrderChatAdministrator,
  sendRepairOrderChatMessage,
} from "@/lib/api";

export const RepairOrderChat = ({
  token,
  orderId,
  defaultOpen = false,
}: {
  token: string;
  orderId: string;
  defaultOpen?: boolean;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [content, setContent] = useState("");
  const lastReadMessageId = useRef<string | null>(null);
  const isAdmin = hasPermission(user, "communications");
  const isTechnician = hasPermission(user, "repairs");
  const queryKey = ["repair-order-chat", token, orderId];
  const chat = useQuery({
    queryKey,
    queryFn: ({ signal }) => getRepairOrderChat(token, orderId, signal),
    enabled: isOpen,
    refetchInterval: isOpen ? 5_000 : false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const join = useMutation({
    mutationFn: () => joinAdminToRepairOrderChat(token, orderId),
    onSuccess: refresh,
    onError: () => toast.error("Не удалось открыть чат этой заявки."),
  });
  const requestAdministrator = useMutation({
    mutationFn: () => requestRepairOrderChatAdministrator(token, orderId),
    onSuccess: async () => {
      await refresh();
      toast.success("Запрос на подключение отправлен администраторам.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось позвать администратора."),
  });
  const send = useMutation({
    mutationFn: (message: string) => sendRepairOrderChatMessage(token, orderId, message),
    onSuccess: async () => {
      setContent("");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отправить сообщение."),
  });
  const read = useMutation({
    mutationFn: (messageId: string) => markRepairOrderChatRead(token, orderId, messageId),
    onSuccess: async (_result, messageId) => {
      lastReadMessageId.current = messageId;
      await queryClient.invalidateQueries({
        queryKey: ["admin-repair-chat-notifications", token],
      });
    },
  });
  const isJoined = Boolean(chat.data?.chat.adminJoinedAt);
  const adminRequested = Boolean(chat.data?.chat.adminRequestedAt);
  const canSend = user?.role === "CUSTOMER" || isTechnician || (isAdmin && isJoined);
  const latestMessageId = chat.data?.chat.messages.at(-1)?.id;
  const markRead = read.mutate;
  const isMarkingRead = read.isPending;

  useEffect(() => {
    if (
      !isAdmin ||
      !latestMessageId ||
      latestMessageId === lastReadMessageId.current ||
      isMarkingRead
    )
      return;
    lastReadMessageId.current = latestMessageId;
    markRead(latestMessageId);
  }, [isAdmin, isMarkingRead, latestMessageId, markRead]);

  return (
    <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
      >
        {isOpen
          ? "Скрыть переписку"
          : isAdmin
            ? "Открыть чат с клиентом"
            : isTechnician
              ? "Открыть чат заявки"
              : "Написать администратору"}
      </button>
      {isOpen && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {isAdmin
                  ? "Чат с клиентом"
                  : isTechnician
                    ? "Чат по заявке"
                    : "Чат с администратором"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Переписка доступна участникам этой заявки.
              </p>
            </div>
            {isAdmin && !isJoined && (
              <button
                type="button"
                onClick={() => join.mutate()}
                disabled={join.isPending || chat.isLoading || chat.isError}
                className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {join.isPending ? "Подключаемся…" : "Подключиться к чату"}
              </button>
            )}
            {isTechnician && !isJoined && (
              <button
                type="button"
                onClick={() => requestAdministrator.mutate()}
                disabled={
                  adminRequested || requestAdministrator.isPending || chat.isLoading || chat.isError
                }
                className="min-h-10 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300"
              >
                {requestAdministrator.isPending
                  ? "Отправляем запрос…"
                  : adminRequested
                    ? "Администратор уведомлён"
                    : "Позвать администратора"}
              </button>
            )}
          </div>

          <div
            aria-live="polite"
            className="mt-4 grid max-h-96 gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
          >
            {(chat.data?.chat.messages ?? []).map((message) => (
              <article
                key={message.id}
                className={`max-w-[90%] rounded-xl p-3 text-sm ${
                  message.sender?.id === user?.id
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <p className="mb-1 text-[11px] opacity-75">
                  {message.sender?.displayName ?? "Участник чата"} ·{" "}
                  {new Date(message.createdAt).toLocaleString("ru-RU")}
                </p>
                {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
              </article>
            ))}
            {chat.isLoading && <p className="text-sm text-slate-500">Загружаем переписку…</p>}
            {!chat.isLoading && chat.data?.chat.messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Пока нет сообщений. Напишите вопрос по этой заявке.
              </p>
            )}
            {chat.isError && (
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить чат. Обновите страницу и попробуйте снова.
              </p>
            )}
          </div>

          {canSend ? (
            <form
              className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const message = content.trim();
                if (message) send.mutate(message);
              }}
            >
              <label className="sr-only" htmlFor={`repair-message-${orderId}`}>
                Сообщение {isAdmin ? "клиенту" : "по заявке"}
              </label>
              <input
                id={`repair-message-${orderId}`}
                value={content}
                onChange={(event) => setContent(event.currentTarget.value)}
                maxLength={2000}
                placeholder={
                  isAdmin ? "Напишите клиенту по заявке…" : "Напишите сообщение по заявке…"
                }
                className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="submit"
                disabled={!content.trim() || send.isPending}
                className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {send.isPending ? "Отправляем…" : "Отправить"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Для отправки ответа администратор должен подключиться к переписке.
            </p>
          )}
        </>
      )}
    </section>
  );
};
