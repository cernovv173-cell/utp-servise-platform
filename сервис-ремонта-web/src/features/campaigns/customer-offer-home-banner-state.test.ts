import { describe, expect, it } from "vitest";

import type { PublicCompletedCustomerOffer, PublicCustomerOffer } from "@/lib/api";

import {
  getCompletedCustomerOffers,
  getRunningCustomerOffers,
} from "./customer-offer-home-banner-state";

const offer = (overrides: Partial<PublicCustomerOffer> = {}): PublicCustomerOffer => ({
  id: "offer",
  type: "PROMOTION",
  title: "Предложение",
  content: "Описание предложения",
  firstPlacePrize: null,
  firstPlacePrizeImageId: null,
  firstPlacePoints: 0,
  secondPlacePrize: null,
  secondPlacePrizeImageId: null,
  secondPlacePoints: 0,
  thirdPlacePrize: null,
  thirdPlacePrizeImageId: null,
  thirdPlacePoints: 0,
  startsAt: "2026-10-28T10:00:00.000Z",
  endsAt: "2026-10-28T18:00:00.000Z",
  ...overrides,
});

const completedOffer = (
  overrides: Partial<PublicCompletedCustomerOffer> = {},
): PublicCompletedCustomerOffer => ({
  id: "completed",
  type: "GIVEAWAY",
  title: "Розыгрыш",
  endsAt: "2026-10-27T18:00:00.000Z",
  resultsPublishedAt: "2026-10-27T19:00:00.000Z",
  winners: [
    {
      place: 1,
      displayName: "Игорь",
      prize: "сертификат",
      bonusPoints: 0,
      prizeImageId: null,
    },
  ],
  ...overrides,
});

describe("home customer offers", () => {
  it("shows only offers currently in progress, including their start but not end time", () => {
    const asOf = Date.parse("2026-10-28T12:00:00.000Z");

    const running = offer({ id: "running" });
    const startingNow = offer({ id: "starting-now", startsAt: "2026-10-28T12:00:00.000Z" });
    const endingNow = offer({ id: "ending-now", endsAt: "2026-10-28T12:00:00.000Z" });
    const upcoming = offer({ id: "upcoming", startsAt: "2026-10-28T12:00:01.000Z" });
    const ended = offer({ id: "ended", endsAt: "2026-10-28T11:59:59.000Z" });

    expect(
      getRunningCustomerOffers([running, startingNow, endingNow, upcoming, ended], asOf).map(
        ({ id }) => id,
      ),
    ).toEqual(["running", "starting-now"]);
  });

  it("orders live offers by the nearest end time", () => {
    const later = offer({ id: "later", endsAt: "2026-10-29T18:00:00.000Z" });
    const sooner = offer({ id: "sooner", endsAt: "2026-10-28T18:00:00.000Z" });

    expect(
      getRunningCustomerOffers([later, sooner], Date.parse("2026-10-28T12:00:00.000Z")),
    ).toEqual([sooner, later]);
  });

  it("shows only published results of finished offers with winners, newest first", () => {
    const asOf = Date.parse("2026-10-28T12:00:00.000Z");
    const earlier = completedOffer({
      id: "earlier",
      endsAt: "2026-10-26T18:00:00.000Z",
      resultsPublishedAt: "2026-10-26T19:00:00.000Z",
    });
    const later = completedOffer({ id: "later" });
    const notPublished = completedOffer({
      id: "not-published",
      resultsPublishedAt: "2026-10-28T13:00:00.000Z",
    });
    const withoutWinners = completedOffer({ id: "without-winners", winners: [] });
    const stillRunning = completedOffer({
      id: "still-running",
      endsAt: "2026-10-29T18:00:00.000Z",
    });

    expect(
      getCompletedCustomerOffers(
        [earlier, later, notPublished, withoutWinners, stillRunning],
        asOf,
      ).map(({ id }) => id),
    ).toEqual(["later", "earlier"]);
  });

  it("tolerates an older public offers response without completed results", () => {
    expect(getCompletedCustomerOffers(undefined, Date.parse("2026-10-28T12:00:00.000Z"))).toEqual(
      [],
    );
  });
});
