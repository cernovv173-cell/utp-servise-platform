import type { PublicCompletedCustomerOffer, PublicCustomerOffer } from "@/lib/api";

export const getRunningCustomerOffers = (offers: PublicCustomerOffer[], asOf: number) =>
  offers
    .filter((offer) => Date.parse(offer.startsAt) <= asOf && Date.parse(offer.endsAt) > asOf)
    .sort((left, right) => Date.parse(left.endsAt) - Date.parse(right.endsAt));

export const getCompletedCustomerOffers = (
  offers: PublicCompletedCustomerOffer[] | undefined,
  asOf: number,
) =>
  (offers ?? [])
    .filter(
      (offer) =>
        offer.winners.length > 0 &&
        Date.parse(offer.endsAt) <= asOf &&
        Date.parse(offer.resultsPublishedAt) <= asOf,
    )
    .sort((left, right) => Date.parse(right.endsAt) - Date.parse(left.endsAt));
