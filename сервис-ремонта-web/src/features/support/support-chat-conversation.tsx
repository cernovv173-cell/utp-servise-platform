import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import {
  getAdminSupportChat,
  getSupportChat,
  sendAdminSupportMessage,
  sendSupportChatMessage,
} from "@/lib/api";

export const SupportChatConversation = ({ customerId }: { customerId?: string }) => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const isAdmin = user?.role === "ADMIN";
  const queryKey = ["support-chat", token, isAdmin ? customerId : "self"];
  const chat = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      isAdmin ? getAdminSupportChat(token!, customerId!, signal) : getSupportChat(token!, signal),
    enabled: Boolean(token && (!isAdmin || customerId)),
    refetchInterval: 5_000,
  });
  const send = useMutation({
    mutationFn: (message: string) =>
      isAdmin
        ? sendAdminSupportMessage(token!, customerId!, message)
        : sendSupportChatMessage(token!, message),
    onSuccess: async () => {
      setContent("");
      await queryClient.invalidateQueries({ queryKey });
      if (isAdmin) {
        await queryClient.invalidateQueries({ queryKey: ["admin-support-chats", token] });
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отправить сообщение."),
  });
  const conversation = chat.data?.chat;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = content.trim();
    if (message) send.mutate(message);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {isAdmin ? conversation?.customer.displayName || "Чат с клиентом" : "Чат с поддержкой"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? conversation?.customer.email || "Переписка с клиентом"
              : "Напишите администратору — ответ появится здесь."}
          </p>
        </div>
        {isAdmin && conversation?.customer.phoneNumber && (
          <a
            href={`tel:${conversation.customer.phoneNumber}`}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {conversation.customer.phoneNumber}
          </a>
        )}
      </div>

      <div
        aria-live="polite"
        className="mt-4 grid max-h-[min(55vh,34rem)] min-h-48 content-start gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60"
      >
        {(conversation?.messages ?? []).map((message) => {
          const isOwnMessage = message.senderId === user?.id;
          return (
            <article
              key={message.id}
              className={`max-w-[90%] rounded-xl p-3 text-sm ${
                isOwnMessage
                  ? "ml-auto bg-blue-600 text-white"
                  : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              <p className="mb-1 text-[11px] opacity-75">
                {message.sender?.displayName ?? "Участник"} ·{" "}
                {new Date(message.createdAt).toLocaleString("ru-RU")}
              </p>
              <p className="break-words whitespace-pre-wrap">{message.content}</p>
            </article>
          );
        })}
        {chat.isLoading && <p className="text-sm text-slate-500">Загружаем переписку…</p>}
        {!chat.isLoading && !chat.isError && conversation?.messages.length === 0 && (
          <p className="self-center py-8 text-center text-sm text-slate-500">
            Сообщений пока нет. Напишите первое сообщение.
          </p>
        )}
        {chat.isError && (
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить чат. Проверьте доступ и обновите страницу.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor="support-chat-message">
          Сообщение в поддержку
        </label>
        <textarea
          id="support-chat-message"
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          maxLength={2000}
          rows={2}
          placeholder={isAdmin ? "Ответ клиенту…" : "Ваше сообщение…"}
          disabled={chat.isError || chat.isLoading}
          className="min-h-11 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={!content.trim() || send.isPending || chat.isLoading || chat.isError}
          className="min-h-11 self-end rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {send.isPending ? "Отправляем…" : "Отправить"}
        </button>
      </form>
    </section>
  );
};
