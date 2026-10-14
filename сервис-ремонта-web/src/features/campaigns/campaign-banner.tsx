import { useQuery } from "@tanstack/react-query";

import { SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";

import { type SiteBanner, getBanners } from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

const appRoutes: Record<string, string> = {
  home: "/",
  news: "/news",
  services: "/about",
  crafts: "/crafts",
  about: "/about",
  loyalty: "/loyalty",
  checks: "/checks",
};

export const CampaignBanner = ({
  banner,
  className = "",
}: {
  banner: SiteBanner;
  className?: string;
}) => {
  const now = useCurrentTime();
  if (
    !banner.isActive ||
    (banner.startsAt && new Date(banner.startsAt).getTime() > now) ||
    (banner.endsAt && new Date(banner.endsAt).getTime() <= now)
  ) {
    return null;
  }
  const internalRoute = banner.targetUrl?.match(/^app:\/\/([^/]+)$/i)?.[1];
  const href = internalRoute
    ? appRoutes[internalRoute.toLowerCase()]
    : (banner.targetUrl ?? undefined);
  const isExternal = Boolean(href && !internalRoute);

  return (
    <SectionCard className={`overflow-hidden p-0 ${className}`}>
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
        className="block"
        aria-label={`Реклама: ${banner.title}`}
      >
        <ProtectedImage
          objectId={banner.imageObjectId}
          alt={banner.title}
          loading="lazy"
          className="max-h-56 w-full object-cover"
        />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-semibold text-blue-600">Предложение сервиса</p>
            <h2 className="mt-1 text-lg font-semibold">{banner.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{banner.content}</p>
          </div>
          {href && (
            <span className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">
              Подробнее
            </span>
          )}
        </div>
      </a>
    </SectionCard>
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
  });
  const campaigns = (query.data?.banners ?? []).filter((banner) =>
    banner.placements.includes(placement),
  );
  if (!campaigns.length) return null;
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className}`}>
      {campaigns.map((banner) => (
        <CampaignBanner key={banner.id} banner={banner} />
      ))}
    </div>
  );
};
