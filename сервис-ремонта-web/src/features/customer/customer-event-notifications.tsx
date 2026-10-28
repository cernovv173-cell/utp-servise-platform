import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { getCustomerOffers, getNews, getOrders } from "@/lib/api";

import {
  type CustomerNotificationSnapshot,
  collectCustomerNotifications,
} from "./customer-event-notification-state";

const POLL_INTERVAL_MS = 30_000;
type BrowserNotificationPermission = NotificationPermission | "unsupported";

const getPermission = (): BrowserNotificationPermission =>
  typeof window !== "undefined" && "Notification" in window
    ? window.Notification.permission
    : "unsupported";

const readSnapshot = (key: string): CustomerNotificationSnapshot | null => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      typeof value !== "object" ||
      value === null ||
      !Array.isArray((value as CustomerNotificationSnapshot).newsIds) ||
      !Array.isArray((value as CustomerNotificationSnapshot).offerIds) ||
      typeof (value as CustomerNotificationSnapshot).orderStatuses !== "object"
    ) {
      return null;
    }
    return value as CustomerNotificationSnapshot;
  } catch {
    return null;
  }
};

const saveSnapshot = (key: string, snapshot: CustomerNotificationSnapshot) => {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // The in-memory copy still prevents duplicate alerts for this open session.
  }
};

export const CustomerEventNotifications = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isCustomer = Boolean(token && user?.role === "CUSTOMER");
  const [permission, setPermission] = useState<BrowserNotificationPermission>(getPermission);
  const memorySnapshots = useRef(new Map<string, CustomerNotificationSnapshot>());

  const news = useQuery({
    queryKey: ["customer-notification-news", token],
    queryFn: ({ signal }) => getNews(token!, signal),
    enabled: isCustomer,
    refetchInterval: isCustomer ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const offers = useQuery({
    queryKey: ["customer-notification-offers", token],
    queryFn: ({ signal }) => getCustomerOffers(token!, signal),
    enabled: isCustomer,
    refetchInterval: isCustomer ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const activeOrders = useQuery({
    queryKey: ["customer-notification-orders", "active", token],
    queryFn: ({ signal }) => getOrders(token!, signal, "active"),
    enabled: isCustomer,
    refetchInterval: isCustomer ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const archivedOrders = useQuery({
    queryKey: ["customer-notification-orders", "archived", token],
    queryFn: ({ signal }) => getOrders(token!, signal, "archived"),
    enabled: isCustomer,
    refetchInterval: isCustomer ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (
      !isCustomer ||
      !user ||
      !news.data ||
      !offers.data ||
      !activeOrders.data ||
      !archivedOrders.data
    ) {
      return;
    }

    const key = `utp-web-customer-events:${user.id}`;
    const previous = readSnapshot(key) ?? memorySnapshots.current.get(key) ?? null;
    const ordersById = new Map(
      [...activeOrders.data.orders, ...archivedOrders.data.orders].map((order) => [
        order.id,
        order,
      ]),
    );
    const { events, snapshot } = collectCustomerNotifications(
      news.data.articles,
      offers.data.offers,
      [...ordersById.values()],
      previous,
      Date.now(),
    );
    memorySnapshots.current.set(key, snapshot);
    saveSnapshot(key, snapshot);
    if (!previous) return;

    for (const event of events) {
      const openDestination = () => {
        void navigate({ to: event.route });
      };
      if (permission === "granted" && document.visibilityState === "hidden") {
        try {
          const notification = new window.Notification(event.title, {
            body: event.body,
            tag: `utp-customer-${event.id}`,
          });
          notification.onclick = () => {
            window.focus();
            openDestination();
            notification.close();
          };
          continue;
        } catch {
          // Keep the in-site alert available if system notifications are blocked.
        }
      }

      toast.info(event.title, {
        description: event.body,
        action: { label: "Открыть", onClick: openDestination },
      });
    }
  }, [
    activeOrders.data,
    archivedOrders.data,
    isCustomer,
    navigate,
    news.data,
    offers.data,
    permission,
    user,
  ]);

  if (!isCustomer) return null;

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
    if (result === "granted") {
      toast.success("Системные уведомления включены.");
    } else {
      toast.info("Пока сайт открыт, уведомления будут показываться внутри приложения.");
    }
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
