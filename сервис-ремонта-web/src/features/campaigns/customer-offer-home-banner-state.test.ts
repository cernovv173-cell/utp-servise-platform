import { describe, expect, it } from "vitest";

import type { PublicCustomerOffer } from "@/lib/api";

import { getRunningCustomerOffers } from "./customer-offer-home-banner-state";

const offer = (overrides: Partial<PublicCustomerOffer> = {}): PublicCustomerOffer => ({
  id: "offer",
  type: "PROMOTION",
  title: "Предложение",
  content: "Описание предложения",
  firstPlacePrize: null,
  firstPlacePoints: 0,
  secondPlacePrize: null,
  secondPlacePoints: 0,
  thirdPlacePrize: null,
  thirdPlacePoints: 0,
  startsAt: "2026-10-28T10:00:00.000Z",
  endsAt: "2026-10-28T18:00:00.000Z",
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
});
