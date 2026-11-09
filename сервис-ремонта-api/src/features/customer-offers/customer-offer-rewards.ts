export type CustomerOfferReward = {
  readonly place: 1 | 2 | 3;
  readonly prize: string | null;
  readonly bonusPoints: number;
};

export type CustomerOfferRewardSource = {
  readonly firstPlacePrize: string | null;
  readonly firstPlacePoints: number;
  readonly secondPlacePrize: string | null;
  readonly secondPlacePoints: number;
  readonly thirdPlacePrize: string | null;
  readonly thirdPlacePoints: number;
};

export const getCustomerOfferRewards = (
  offer: CustomerOfferRewardSource,
): CustomerOfferReward[] => [
  {
    place: 1,
    prize: offer.firstPlacePrize,
    bonusPoints: offer.firstPlacePoints,
  },
  {
    place: 2,
    prize: offer.secondPlacePrize,
    bonusPoints: offer.secondPlacePoints,
  },
  {
    place: 3,
    prize: offer.thirdPlacePrize,
    bonusPoints: offer.thirdPlacePoints,
  },
];

export const getCustomerOfferReward = (
  offer: CustomerOfferRewardSource,
  place: number,
): CustomerOfferReward | undefined =>
  getCustomerOfferRewards(offer).find((reward) => reward.place === place);
