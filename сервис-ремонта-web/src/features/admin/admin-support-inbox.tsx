import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/features/auth/auth-context";

import { getAdminSupportChats } from "@/lib/api";

export const AdminSupportInbox = () => {
  const { token } = useAuth();
  const chats = useQuery({
    queryKey: ["admin-support-chats", token],
    queryFn: ({ signal }) => getAdminSupportChats(token!, signal),
    enabled: Boolean(token),
    refetchInterval: 5_000,
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Обращения клиентов</h2>
          <p className="mt-1 text-sm text-slate-500">Ответы и вопросы клиентов в поддержку.</p>
        </div>
        <button
          type="button"
          onClick={() => void chats.refetch()}
          disabled={chats.isFetching}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700"
        >
          Обновить
        </button>
      </div>
      {chats.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем обращения…</p>}
      {chats.isError && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          Не удалось загрузить обращения. Проверьте права доступа и повторите попытку.
        </p>
      )}
      {!chats.isLoading && !chats.isError && (chats.data?.chats.length ?? 0) === 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950/60">
          Обращений пока нет. Новые сообщения клиентов появятся здесь.
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {(chats.data?.chats ?? []).map((chat) => {
          const latestMessage = chat.messages[0];
          return (
            <Link
              key={chat.id}
              to="/support/$customerId"
              params={{ customerId: chat.customer.id }}
              className="block rounded-xl border border-slate-100 p-4 transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-slate-800/70"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{chat.customer.displayName}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {chat.customer.email || "вход через МАКС"}
                  </p>
                </div>
                <time className="text-xs text-slate-400">
                  {new Date(chat.updatedAt).toLocaleString("ru-RU")}
                </time>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                {latestMessage?.content ?? "Нет сообщений"}
              </p>
              {latestMessage?.sender && (
                <p className="mt-1 text-xs text-slate-400">
                  Последнее сообщение: {latestMessage.sender.displayName}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
};
