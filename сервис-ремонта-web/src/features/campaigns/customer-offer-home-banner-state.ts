import type { PublicCustomerOffer } from "@/lib/api";

export const getRunningCustomerOffers = (offers: PublicCustomerOffer[], asOf: number) =>
  offers
    .filter((offer) => Date.parse(offer.startsAt) <= asOf && Date.parse(offer.endsAt) > asOf)
    .sort((left, right) => Date.parse(left.endsAt) - Date.parse(right.endsAt));
