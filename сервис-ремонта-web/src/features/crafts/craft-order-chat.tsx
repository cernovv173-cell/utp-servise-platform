import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { ProtectedImage } from "@/components/protected-image";

import { getCraftOrderChat, sendCraftOrderChatMessage, uploadCraftOrderChatImage } from "@/lib/api";

export const CraftOrderChatPanel = ({
  token,
  craftOrderId,
  isAdmin,
  status,
}: {
  token: string;
  craftOrderId: string;
  isAdmin: boolean;
  status: string;
}) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(status === "IN_PROGRESS");
  const [content, setContent] = useState("");
  useEffect(() => {
    if (status === "IN_PROGRESS") setIsOpen(true);
  }, [status]);
  const chat = useQuery({
    queryKey: ["craft-order-chat", token, craftOrderId],
    queryFn: ({ signal }) => getCraftOrderChat(token, craftOrderId, signal),
    enabled: isOpen,
    refetchInterval: isOpen ? 5_000 : false,
  });
  const send = useMutation({
    mutationFn: (message: string) => sendCraftOrderChatMessage(token, craftOrderId, message),
    onSuccess: async () => {
      setContent("");
      await queryClient.invalidateQueries({ queryKey: ["craft-order-chat", token, craftOrderId] });
    },
    onError: () => toast.error("Не удалось отправить сообщение."),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadCraftOrderChatImage(token, craftOrderId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["craft-order-chat", token, craftOrderId] });
      toast.success("Фото отправлено в чат заявки.");
    },
    onError: () => toast.error("Не удалось отправить фото. Поддерживаются изображения до 5 МБ."),
  });

  return (
    <section className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700"
      >
        {isOpen ? "Скрыть чат" : "Открыть чат по заявке"}
        {status === "IN_PROGRESS" ? " · В работе" : ""}
      </button>
      {isOpen && (
        <>
          <p className="mt-2 text-xs text-slate-500">
            Сообщения и фото видны клиенту и администратору этой заявки.
          </p>
          <div className="mt-3 grid max-h-80 gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
            {(chat.data?.chat.messages ?? []).map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-xl p-3 text-sm ${
                  message.sender?.role === (isAdmin ? "ADMIN" : "CUSTOMER")
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <p className="mb-1 text-[11px] opacity-75">
                  {message.sender?.displayName ?? "Участник чата"} ·{" "}
                  {new Date(message.createdAt).toLocaleString("ru-RU")}
                </p>
                {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                {message.imageObjectId && (
                  <ProtectedImage
                    objectId={message.imageObjectId}
                    alt="Фото в чате заявки"
                    loading="lazy"
                    className="mt-2 max-h-56 max-w-full rounded-lg object-contain"
                  />
                )}
              </div>
            ))}
            {chat.isLoading && <p className="text-sm text-slate-500">Загружаем переписку…</p>}
            {!chat.isLoading && (chat.data?.chat.messages.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500">
                Пока нет сообщений. Можно отправить фото или вопрос.
              </p>
            )}
            {chat.isError && (
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить чат.
              </p>
            )}
          </div>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const trimmed = content.trim();
              if (trimmed) send.mutate(trimmed);
            }}
          >
            <label className="sr-only" htmlFor={`craft-message-${craftOrderId}`}>
              Сообщение по заявке
            </label>
            <input
              id={`craft-message-${craftOrderId}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={2000}
              placeholder="Сообщение по заявке…"
              className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <label className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              {upload.isPending ? "Отправляем фото…" : "Фото"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Выберите изображение размером не более 5 МБ.");
                      return;
                    }
                    upload.mutate(file);
                  }
                }}
              />
            </label>
            <button
              disabled={!content.trim() || send.isPending}
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Отправить
            </button>
          </form>
        </>
      )}
    </section>
  );
};
