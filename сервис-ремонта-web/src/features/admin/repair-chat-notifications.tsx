import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { getAdminRepairChatNotifications } from "@/lib/api";

import { collectNewRepairChatMessages } from "./repair-chat-notification-state";

const POLL_INTERVAL_MS = 15_000;

export const RepairChatNotifications = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = Boolean(token && user?.role === "ADMIN");
  const seenMessages = useRef(new Map<string, string>());
  const initialSnapshotLoaded = useRef(false);
  const previousAdminId = useRef<string | null>(null);
  const unread = useQuery({
    queryKey: ["admin-repair-chat-notifications", token],
    queryFn: ({ signal }) => getAdminRepairChatNotifications(token!, signal),
    enabled: isAdmin,
    refetchInterval: isAdmin ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isAdmin || !user || !unread.data) return;
    if (previousAdminId.current !== user.id) {
      previousAdminId.current = user.id;
      seenMessages.current.clear();
      initialSnapshotLoaded.current = false;
    }
    if (!initialSnapshotLoaded.current) {
      for (const chat of unread.data.chats)
        seenMessages.current.set(chat.orderId, chat.lastMessageId);
      initialSnapshotLoaded.current = true;
      return;
    }

    const newMessages = collectNewRepairChatMessages(unread.data.chats, seenMessages.current);
    for (const chat of newMessages) {
      const openChat = () =>
        void navigate({ to: "/admin/orders/$orderId", params: { orderId: chat.orderId } });
      const title = `Новое сообщение · ${chat.serviceNumber}`;
      const description = `${chat.customerName}: ${chat.preview}`;
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(title, {
            body: description,
            tag: `repair-chat-${chat.orderId}`,
          });
          notification.onclick = () => {
            window.focus();
            openChat();
            notification.close();
          };
          continue;
        } catch {
          // Keep the in-app alert available if system notifications are blocked.
        }
      }
      toast.info(title, {
        description,
        action: { label: "Открыть", onClick: openChat },
      });
    }
  }, [isAdmin, navigate, unread.data, user]);

  if (!isAdmin) return null;
  const count = unread.data?.totalUnread ?? 0;
  const firstChat = unread.data?.chats[0];
  const label = count > 0 ? `Непрочитанных чатов: ${count}` : "Чаты заявок";

  return firstChat ? (
    <Link
      to="/admin/orders/$orderId"
      params={{ orderId: firstChat.orderId }}
      aria-label={label}
      title={label}
      className="relative flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#304373] dark:text-[#b6c8f4] dark:hover:bg-[#152449]"
    >
      <MessageCircle size={17} aria-hidden="true" />
      <span className="hidden xl:inline">Чаты</span>
      <span className="min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] leading-4 font-bold text-white">
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  ) : (
    <Link
      to="/admin/orders"
      aria-label={label}
      title={label}
      className="relative flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#304373] dark:text-[#b6c8f4] dark:hover:bg-[#152449]"
    >
      <MessageCircle size={17} aria-hidden="true" />
      <span className="hidden xl:inline">Чаты</span>
    </Link>
  );
};
