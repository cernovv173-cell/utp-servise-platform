import { describe, expect, it } from "vitest";

import type { SiteBanner } from "@/lib/api";

import { getCampaignIndex, getPublishedCampaigns } from "./campaign-banner-state";

const banner = (overrides: Partial<SiteBanner> = {}): SiteBanner => ({
  id: "banner",
  title: "Предложение",
  content: "Описание",
  imageObjectId: null,
  targetUrl: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  placements: ["HOME"],
  ...overrides,
});

describe("campaign carousel navigation", () => {
  it("returns to the first banner after the last", () => {
    const count = 3;
    const sequence = [0, 1, 2].map((index) => getCampaignIndex(index, 1, count));

    expect(sequence).toEqual([1, 2, 0]);
  });

  it("returns to the last banner when moving back from the first", () => {
    expect(getCampaignIndex(0, -1, 3)).toBe(2);
  });

  it("stays at zero if there are no banners", () => {
    expect(getCampaignIndex(0, 1, 0)).toBe(0);
  });

  it("shows only active banners for this placement within their schedule, oldest first", () => {
    const asOf = Date.parse("2026-10-13T12:00:00.000Z");
    const older = banner({ id: "older" });
    const newer = banner({ id: "newer" });
    const future = banner({ id: "future", startsAt: "2026-10-14T00:00:00.000Z" });
    const expired = banner({ id: "expired", endsAt: "2026-10-12T00:00:00.000Z" });
    const inactive = banner({ id: "inactive", isActive: false });
    const otherPlacement = banner({ id: "other", placements: ["NEWS"] });

    expect(
      getPublishedCampaigns(
        [newer, older, future, expired, inactive, otherPlacement],
        "HOME",
        asOf,
      ).map(({ id }) => id),
    ).toEqual(["older", "newer"]);
  });
});
