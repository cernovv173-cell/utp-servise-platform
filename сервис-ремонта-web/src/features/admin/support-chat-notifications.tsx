import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { getAdminSupportChats } from "@/lib/api";

import { collectNewSupportChatMessages } from "./support-chat-notification-state";

const POLL_INTERVAL_MS = 5_000;

export const SupportChatNotifications = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = Boolean(token && user?.role === "ADMIN");
  const seenMessages = useRef(new Map<string, string>());
  const initialSnapshotLoaded = useRef(false);
  const previousAdminId = useRef<string | null>(null);
  const chats = useQuery({
    queryKey: ["admin-support-chats", token],
    queryFn: ({ signal }) => getAdminSupportChats(token!, signal),
    enabled: isAdmin,
    refetchInterval: isAdmin ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isAdmin || !user || !chats.data) return;
    if (previousAdminId.current !== user.id) {
      previousAdminId.current = user.id;
      seenMessages.current.clear();
      initialSnapshotLoaded.current = false;
    }
    if (!initialSnapshotLoaded.current) {
      for (const chat of chats.data.chats) {
        const latestMessage = chat.messages[0];
        if (latestMessage) seenMessages.current.set(chat.customer.id, latestMessage.id);
      }
      initialSnapshotLoaded.current = true;
      return;
    }

    for (const chat of collectNewSupportChatMessages(chats.data.chats, seenMessages.current)) {
      const latestMessage = chat.messages[0];
      if (!latestMessage) continue;
      const openChat = () =>
        void navigate({ to: "/support/$customerId", params: { customerId: chat.customer.id } });
      const title = `Новое обращение · ${chat.customer.displayName}`;
      const description = latestMessage.content;

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(title, {
            body: description,
            tag: `support-chat-${chat.customer.id}`,
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
  }, [chats.data, isAdmin, navigate, user]);

  return null;
};
