import type { CustomerOffer, NewsArticle, RepairOrder } from "@/lib/api";

const MAX_REMEMBERED_IDS = 1_000;

export type CustomerNotificationSnapshot = {
  newsIds: string[];
  offerIds: string[];
  orderStatuses: Record<string, string>;
};

export type CustomerNotificationEvent = {
  id: string;
  title: string;
  body: string;
  route: "/news" | "/offers" | "/orders";
};

const rememberIds = (current: string[], previous: string[] = []) =>
  [...new Set([...current, ...previous])].slice(0, MAX_REMEMBERED_IDS);

export const collectCustomerNotifications = (
  articles: NewsArticle[],
  offers: CustomerOffer[],
  orders: RepairOrder[],
  previous: CustomerNotificationSnapshot | null,
  nowMillis: number,
): { events: CustomerNotificationEvent[]; snapshot: CustomerNotificationSnapshot } => {
  const visibleArticles = articles.filter((article) => article.isPublished);
  const publishedOffers = offers.filter((offer) => {
    const endsAt = Date.parse(offer.endsAt);
    return offer.isPublished && nowMillis < endsAt;
  });
  const events: CustomerNotificationEvent[] = [];

  if (previous) {
    const knownNews = new Set(previous.newsIds);
    for (const article of visibleArticles) {
      if (knownNews.has(article.id)) continue;
      events.push({
        id: `news-${article.id}`,
        title: "Новая новость ЕНОТ СЕРВИС",
        body: article.title,
        route: "/news",
      });
    }

    const knownOffers = new Set(previous.offerIds);
    for (const offer of publishedOffers) {
      if (knownOffers.has(offer.id)) continue;
      events.push({
        id: `offer-${offer.id}`,
        title:
          offer.type === "GIVEAWAY"
            ? "Опубликован новый розыгрыш ЕНОТ СЕРВИС"
            : "Опубликована новая акция ЕНОТ СЕРВИС",
        body: offer.title,
        route: "/offers",
      });
    }

    const knownOrderStatuses = previous.orderStatuses;
    for (const order of orders) {
      const previousStatus = knownOrderStatuses[order.id];
      if (order.status === "READY_FOR_PICKUP" && previousStatus !== "READY_FOR_PICKUP") {
        events.push({
          id: `repair-ready-${order.id}`,
          title: "Ремонт готов к выдаче",
          body: `Заявка ${order.serviceNumber}: технику можно забрать.`,
          route: "/orders",
        });
      } else if (order.status === "COMPLETED" && previousStatus !== "COMPLETED") {
        events.push({
          id: `repair-completed-${order.id}`,
          title: "Ремонт завершён",
          body: `Заявка ${order.serviceNumber}: техника выдана.`,
          route: "/orders",
        });
      }
    }
  }

  const currentOrderStatuses = Object.fromEntries(orders.map((order) => [order.id, order.status]));
  const orderStatuses = {
    ...previous?.orderStatuses,
    ...currentOrderStatuses,
  };
  const rememberedOrderStatuses = Object.fromEntries(
    Object.entries(orderStatuses).slice(0, MAX_REMEMBERED_IDS),
  );

  return {
    events,
    snapshot: {
      newsIds: rememberIds(
        visibleArticles.map((article) => article.id),
        previous?.newsIds,
      ),
      offerIds: rememberIds(
        publishedOffers.map((offer) => offer.id),
        previous?.offerIds,
      ),
      orderStatuses: rememberedOrderStatuses,
    },
  };
};
