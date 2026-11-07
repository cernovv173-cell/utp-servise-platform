import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Gift, Trophy } from "lucide-react";

import { PublicAuthTrigger } from "@/components/public-site-shell";

import { getRunningCustomerOffers } from "@/features/campaigns/customer-offer-home-banner-state";

import { getPublicCustomerOffers } from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

const formatEndDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const CustomerOfferHomeBanners = ({ isCustomer = false }: { isCustomer?: boolean }) => {
  const now = useCurrentTime();
  const query = useQuery({
    queryKey: ["public-customer-offers"],
    queryFn: ({ signal }) => getPublicCustomerOffers(signal),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const offers = getRunningCustomerOffers(query.data?.offers ?? [], now);

  if (offers.length === 0) return null;

  return (
    <section
      aria-labelledby="home-customer-offers-title"
      className="mx-auto max-w-7xl px-4 py-8 md:px-8"
    >
      <div className="mb-5">
        <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
          Акции и розыгрыши
        </p>
        <h2
          id="home-customer-offers-title"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Сейчас проходят
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((offer) => {
          const isGiveaway = offer.type === "GIVEAWAY";
          const Icon = isGiveaway ? Trophy : Gift;
          const rewards = [
            { place: 1, prize: offer.firstPlacePrize, points: offer.firstPlacePoints },
            { place: 2, prize: offer.secondPlacePrize, points: offer.secondPlacePoints },
            { place: 3, prize: offer.thirdPlacePrize, points: offer.thirdPlacePoints },
          ].filter((reward) => reward.prize || reward.points > 0);

          return (
            <article
              key={offer.id}
              className={`relative flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-lg sm:p-8 ${isGiveaway ? "from-violet-800 via-indigo-700 to-purple-600" : "from-blue-800 via-sky-700 to-cyan-600"} ${offers.length === 1 ? "lg:col-span-2" : ""}`}
            >
              <div className="flex items-start gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/15 backdrop-blur">
                  <Icon size={28} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-[0.16em] text-white/80 uppercase">
                    {isGiveaway ? "Розыгрыш" : "Акция"}
                  </p>
                  <h3 className="mt-1 text-xl leading-tight font-bold sm:text-2xl">
                    {offer.title}
                  </h3>
                </div>
              </div>

              <p className="mt-4 line-clamp-4 max-w-3xl text-sm leading-6 text-white/90 sm:text-base">
                {offer.content}
              </p>

              {rewards.length > 0 && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                  {rewards.map(({ place, prize, points }) => (
                    <li
                      key={place}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm"
                    >
                      <span className="block text-xs font-semibold text-white/70">
                        {place}-е место
                      </span>
                      <span className="mt-0.5 block font-medium">
                        {[prize, points > 0 ? `${points} баллов` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-4">
                <p className="text-sm text-white/80">Действует до {formatEndDate(offer.endsAt)}</p>
                {isCustomer ? (
                  <Link
                    to="/offers"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-slate-900 transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Условия и участие <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                ) : (
                  <PublicAuthTrigger
                    intent="login"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-slate-900 transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Войти и участвовать <ArrowRight size={17} aria-hidden="true" />
                  </PublicAuthTrigger>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
