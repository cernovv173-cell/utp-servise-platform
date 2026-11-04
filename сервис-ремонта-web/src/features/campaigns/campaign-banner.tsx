import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "@/components/app-shell";
import { ProtectedMedia } from "@/components/protected-media";

import { useAuth } from "@/features/auth/auth-context";
import {
  getCampaignIndex,
  getPublishedCampaigns,
} from "@/features/campaigns/campaign-banner-state";

import { type SiteBanner, getBanners } from "@/lib/api";

const appRoutes: Record<string, string> = {
  home: "/",
  news: "/news",
  services: "/about",
  crafts: "/crafts",
  about: "/about",
  loyalty: "/loyalty",
  checks: "/checks",
};

const CampaignBannerCard = ({ banner }: { banner: SiteBanner }) => {
  const internalRoute = banner.targetUrl?.match(/^app:\/\/([^/]+)$/i)?.[1];
  const href = internalRoute
    ? appRoutes[internalRoute.toLowerCase()]
    : (banner.targetUrl ?? undefined);
  const isExternal = Boolean(href && !internalRoute);
  return (
    <SectionCard className="overflow-hidden !p-2 sm:!p-2.5">
      <div className="flex min-h-20 items-center gap-3">
        <ProtectedMedia
          objectId={banner.videoObjectId || banner.imageObjectId}
          alt={banner.title}
          className="h-16 w-20 shrink-0 rounded-lg object-cover sm:h-[4.5rem] sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-wide text-blue-600 uppercase">Реклама</p>
          {href ? (
            <a
              href={href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noreferrer" : undefined}
              className="rounded-sm focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <h2 className="mt-0.5 line-clamp-1 text-sm font-semibold sm:text-base">
                {banner.title}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500 sm:text-sm">
                {banner.content}
              </p>
            </a>
          ) : (
            <>
              <h2 className="mt-0.5 line-clamp-1 text-sm font-semibold sm:text-base">
                {banner.title}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500 sm:text-sm">
                {banner.content}
              </p>
            </>
          )}
        </div>
        {href && <span className="shrink-0 text-xs font-semibold text-blue-700">Подробнее</span>}
      </div>
    </SectionCard>
  );
};

export const CampaignCarousel = ({
  banners,
  placement,
  asOf,
  className = "",
}: {
  banners: SiteBanner[];
  placement: SiteBanner["placements"][number];
  asOf: number;
  className?: string;
}) => {
  const publishedBanners = getPublishedCampaigns(banners, placement, asOf);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPaused = manuallyPaused || isHovered || isFocused;

  useEffect(() => {
    if (isPaused || publishedBanners.length < 2) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => getCampaignIndex(index, 1, publishedBanners.length));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [isPaused, publishedBanners.length]);

  if (!publishedBanners.length) return null;
  const activeIndex = currentIndex % publishedBanners.length;
  const currentBanner = publishedBanners[activeIndex]!;

  return (
    <section
      className={className}
      aria-label="Рекламные предложения"
      aria-roledescription="карусель"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
    >
      <div
        key={currentBanner.id}
        className="motion-safe:animate-[carousel-slide-in_420ms_ease-out]"
        role="group"
        aria-roledescription="слайд"
        aria-label={`Объявление ${activeIndex + 1} из ${publishedBanners.length}`}
        aria-live={isPaused ? "polite" : "off"}
      >
        <CampaignBannerCard banner={currentBanner} />
      </div>
      {publishedBanners.length > 1 && (
        <div className="mt-1 flex items-center justify-end gap-1">
          <span aria-hidden="true" className="mr-1 text-xs text-slate-500 tabular-nums">
            {activeIndex + 1} / {publishedBanners.length}
          </span>
          <button
            type="button"
            aria-label="Предыдущее объявление"
            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
            onClick={() =>
              setCurrentIndex((index) => getCampaignIndex(index, -1, publishedBanners.length))
            }
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            aria-label={
              manuallyPaused
                ? "Продолжить автоматическую смену объявлений"
                : "Приостановить автоматическую смену объявлений"
            }
            aria-pressed={manuallyPaused}
            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
            onClick={() => setManuallyPaused((paused) => !paused)}
          >
            {manuallyPaused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            type="button"
            aria-label="Следующее объявление"
            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
            onClick={() =>
              setCurrentIndex((index) => getCampaignIndex(index, 1, publishedBanners.length))
            }
          >
            <ChevronRight size={17} />
          </button>
        </div>
      )}
    </section>
  );
};

export const CampaignPlacement = ({
  placement,
  className = "",
}: {
  placement: SiteBanner["placements"][number];
  className?: string;
}) => {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["banners", token],
    queryFn: ({ signal }) => getBanners(token!, signal),
    enabled: Boolean(token),
    refetchInterval: 10_000,
  });

  return (
    <CampaignCarousel
      banners={query.data?.banners ?? []}
      placement={placement}
      asOf={query.dataUpdatedAt}
      className={className}
    />
  );
};
