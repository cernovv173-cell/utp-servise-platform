import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { getCraftOrders, getOrders } from "@/lib/api";

import { collectIncomingOrderChanges } from "./incoming-order-notification-state";

const POLL_INTERVAL_MS = 30_000;
type IncomingOrderKind = "repair" | "craft";
type BrowserNotificationPermission = NotificationPermission | "unsupported";
type OrderNotice = { id: string; body: string };

const getPermission = (): BrowserNotificationPermission =>
  typeof window !== "undefined" && "Notification" in window
    ? window.Notification.permission
    : "unsupported";

const readSeenIds = (key: string): string[] | null => {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return null;
    const value: unknown = JSON.parse(saved);
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? value : null;
  } catch {
    return null;
  }
};

const saveSeenIds = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // The in-memory cursor still prevents repeat alerts for this open session.
  }
};

export const IncomingOrderNotifications = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = Boolean(token && user?.role === "ADMIN");
  const [permission, setPermission] = useState<BrowserNotificationPermission>(getPermission);
  const memorySeenIds = useRef(new Map<string, string[]>());
  const repairOrders = useQuery({
    queryKey: ["admin-incoming-orders", "repair", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: isAdmin,
    refetchInterval: isAdmin ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const craftOrders = useQuery({
    queryKey: ["admin-incoming-orders", "craft", token],
    queryFn: ({ signal }) => getCraftOrders(token!, signal),
    enabled: isAdmin,
    refetchInterval: isAdmin ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isAdmin || !user) return;

    const announce = (kind: IncomingOrderKind, title: string, notice: OrderNotice) => {
      const openOrders = () => {
        if (kind === "repair") void navigate({ to: "/admin/orders" });
        else void navigate({ to: "/crafts" });
      };

      if (permission === "granted" && document.visibilityState === "hidden") {
        try {
          const notification = new window.Notification(title, {
            body: notice.body,
            tag: `utp-${kind}-order-${notice.id}`,
          });
          notification.onclick = () => {
            window.focus();
            openOrders();
            notification.close();
          };
          return;
        } catch {
          // Fall back to the in-page alert if the browser blocks a system notification.
        }
      }

      toast.info(title, {
        description: notice.body,
        action: { label: "Открыть", onClick: openOrders },
      });
    };

    const processOrders = (kind: IncomingOrderKind, title: string, notices: OrderNotice[]) => {
      const storageKey = `utp-web-admin-seen-${kind}-orders:${user.id}`;
      const previouslySeenIds =
        readSeenIds(storageKey) ?? memorySeenIds.current.get(storageKey) ?? null;
      const { newlySeenIds, rememberedIds } = collectIncomingOrderChanges(
        notices.map((notice) => notice.id),
        previouslySeenIds,
      );
      memorySeenIds.current.set(storageKey, rememberedIds);
      saveSeenIds(storageKey, rememberedIds);

      if (previouslySeenIds === null) return;
      const newIds = new Set(newlySeenIds);
      for (const notice of notices) {
        if (newIds.has(notice.id)) announce(kind, title, notice);
      }
    };

    if (repairOrders.data) {
      const deviceLabels: Record<string, string> = {
        COMPUTER: "компьютер",
        LAPTOP: "ноутбук",
        PHONE: "телефон",
        TABLET: "планшет",
      };
      processOrders(
        "repair",
        "Новая заявка на ремонт",
        repairOrders.data.orders.map((order) => ({
          id: order.id,
          body: `${order.serviceNumber} · ${order.customer?.displayName ?? "Клиент"} · ${deviceLabels[order.deviceType] ?? "техника"}`,
        })),
      );
    }
    if (craftOrders.data) {
      processOrders(
        "craft",
        "Новый заказ изделия",
        craftOrders.data.orders.map((order) => ({
          id: order.id,
          body: `${order.itemTitleSnapshot} × ${order.quantity} · ${order.customer?.displayName ?? "Клиент"}`,
        })),
      );
    }
  }, [craftOrders.data, isAdmin, navigate, permission, repairOrders.data, user]);

  if (!isAdmin) return null;

  const enableNotifications = async () => {
    if (permission === "unsupported") {
      toast.error("Этот браузер не поддерживает системные уведомления.");
      return;
    }
    if (permission === "denied") {
      toast.error("Разрешите уведомления для сайта в настройках браузера.");
      return;
    }
    const result = await window.Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Уведомления о новых заказах включены.");
    else toast.info("Пока сайт открыт, новые заказы будут показываться внутри веб-приложения.");
  };

  const permissionLabel =
    permission === "granted"
      ? "Системные уведомления включены"
      : permission === "denied"
        ? "Системные уведомления заблокированы"
        : permission === "unsupported"
          ? "Системные уведомления недоступны"
          : "Включить системные уведомления";

  return (
    <button
      type="button"
      aria-label={permissionLabel}
      title={permissionLabel}
      onClick={() => void enableNotifications()}
      className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#304373] dark:text-[#b6c8f4] dark:hover:bg-[#152449]"
    >
      <Bell size={17} aria-hidden="true" />
      <span className="hidden xl:inline">
        {permission === "granted" ? "Уведомления включены" : "Уведомления"}
      </span>
    </button>
  );
};
