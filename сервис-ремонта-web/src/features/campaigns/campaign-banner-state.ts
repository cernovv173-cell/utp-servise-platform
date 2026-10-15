import type { SiteBanner } from "@/lib/api";

export const getPublishedCampaigns = (
  banners: SiteBanner[],
  placement: SiteBanner["placements"][number],
  asOf: number,
) =>
  banners
    .filter(
      (banner) =>
        banner.isActive &&
        banner.placements.includes(placement) &&
        (!banner.startsAt || new Date(banner.startsAt).getTime() <= asOf) &&
        (!banner.endsAt || new Date(banner.endsAt).getTime() > asOf),
    )
    .reverse();

export const getCampaignIndex = (index: number, step: -1 | 1, count: number) =>
  count > 0 ? (index + step + count) % count : 0;
