import { describe, expect, it } from "vitest";

import type { CustomerOffer, NewsArticle, RepairOrder } from "@/lib/api";

import { collectCustomerNotifications } from "./customer-event-notification-state";

const article = (id: string): NewsArticle => ({
  id,
  title: `Новость ${id}`,
  content: "Содержание новости.",
  kind: "NEWS",
  isPublished: true,
  publishedAt: "2026-10-28T10:00:00.000Z",
  startsAt: null,
  endsAt: null,
  isFeatured: false,
});

const offer = (
  id: string,
  startsAt: string,
  endsAt: string,
  type: CustomerOffer["type"] = "PROMOTION",
): CustomerOffer => ({
  id,
  type,
  title: `Предложение ${id}`,
  content: "Условия предложения.",
  firstPlacePrize: null,
  firstPlacePrizeImageId: null,
  firstPlacePoints: 0,
  secondPlacePrize: null,
  secondPlacePrizeImageId: null,
  secondPlacePoints: 0,
  thirdPlacePrize: null,
  thirdPlacePrizeImageId: null,
  thirdPlacePoints: 0,
  isPublished: true,
  startsAt,
  endsAt,
  drawnAt: null,
  resultsPublishedAt: null,
  createdAt: "2026-10-28T10:00:00.000Z",
  participantCount: 0,
  myParticipation: null,
  winners: [],
});

const order = (id: string, status: string): RepairOrder =>
  ({ id, serviceNumber: `SR-${id}`, status }) as RepairOrder;

describe("customer event notifications", () => {
  it("uses the first response only as a baseline", () => {
    const now = Date.parse("2026-10-28T12:00:00.000Z");
    const current = collectCustomerNotifications(
      [article("old-news")],
      [offer("running", "2026-10-28T11:00:00.000Z", "2026-10-28T13:00:00.000Z")],
      [order("repair-1", "IN_PROGRESS")],
      null,
      now,
    );

    expect(current.events).toEqual([]);
    expect(current.snapshot.newsIds).toEqual(["old-news"]);
    expect(current.snapshot.offerIds).toEqual(["running"]);
  });

  it("announces a published future offer immediately without announcing it again at start", () => {
    const now = Date.parse("2026-10-28T12:00:00.000Z");
    const beforeStart = collectCustomerNotifications(
      [],
      [offer("starts-later", "2026-10-28T13:00:00.000Z", "2026-10-28T14:00:00.000Z", "GIVEAWAY")],
      [],
      { newsIds: [], offerIds: [], orderStatuses: {} },
      now,
    );
    expect(beforeStart.events.map((event) => event.id)).toEqual(["offer-starts-later"]);
    expect(beforeStart.events[0]?.title).toBe("Опубликован новый розыгрыш ЕНОТ СЕРВИС");

    const atStart = collectCustomerNotifications(
      [article("new-news")],
      [offer("starts-later", "2026-10-28T13:00:00.000Z", "2026-10-28T14:00:00.000Z", "GIVEAWAY")],
      [],
      beforeStart.snapshot,
      Date.parse("2026-10-28T13:00:00.000Z"),
    );
    expect(atStart.events.map((event) => event.id)).toEqual(["news-new-news"]);
  });

  it("announces repair readiness and final completion once each", () => {
    const now = Date.parse("2026-10-28T12:00:00.000Z");
    const baseline = collectCustomerNotifications(
      [],
      [],
      [order("repair-1", "IN_PROGRESS")],
      null,
      now,
    );
    const ready = collectCustomerNotifications(
      [],
      [],
      [order("repair-1", "READY_FOR_PICKUP")],
      baseline.snapshot,
      now,
    );
    expect(ready.events.map((event) => event.title)).toEqual(["Ремонт готов к выдаче"]);

    const completed = collectCustomerNotifications(
      [],
      [],
      [order("repair-1", "COMPLETED")],
      ready.snapshot,
      now,
    );
    expect(completed.events.map((event) => event.title)).toEqual(["Ремонт завершён"]);
    expect(
      collectCustomerNotifications(
        [],
        [],
        [order("repair-1", "COMPLETED")],
        completed.snapshot,
        now,
      ).events,
    ).toEqual([]);
  });
});
