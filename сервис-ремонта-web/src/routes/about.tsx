import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Mail, MapPin, Phone, Share2 } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { PublicSiteShell } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignPlacement } from "@/features/campaigns/campaign-banner";
import { CUSTOMER_CATALOG_VISIBILITY_QUERY_KEY } from "@/features/catalog/catalog-visibility";

import { getCatalogVisibility, getCompany } from "@/lib/api";
import { createPageHead } from "@/lib/seo";

const AboutPage = () => {
  const { ready, user } = useAuth();
  const query = useQuery({ queryKey: ["company"], queryFn: ({ signal }) => getCompany(signal) });
  const catalogVisibilityQuery = useQuery({
    queryKey: CUSTOMER_CATALOG_VISIBILITY_QUERY_KEY,
    queryFn: ({ signal }) => getCatalogVisibility(signal),
  });
  const servicesVisible = catalogVisibilityQuery.data?.servicesVisible !== false;
  const company = query.data?.company;
  const content = (
    <>
      <PageTitle
        eyebrow="О НАС"
        title={company?.name ?? "О компании"}
        description={company?.description}
      />
      <CampaignPlacement placement="ABOUT" className="mb-5" />
      {company && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-5">
            <SectionCard>
              <h2 className="font-semibold">Наша история</h2>
              <p className="mt-3 text-sm leading-7 whitespace-pre-line text-slate-600 dark:text-slate-300">
                {company.history ||
                  "Мы помогаем возвращать технику к работе и заботимся о каждом обращении."}
              </p>
            </SectionCard>
            {servicesVisible && (
              <SectionCard>
                <h2 className="font-semibold">Услуги</h2>
                <ul className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                  {company.services.map((service) => (
                    <li
                      key={service}
                      className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800"
                    >
                      {service}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
            {company.mediaUrls.length > 0 && (
              <SectionCard>
                <h2 className="mb-3 font-semibold">Фото и видео</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {company.mediaUrls.map((url) =>
                    url.match(/\.(mp4|webm)(\?|$)/iu) ? (
                      <video key={url} src={url} controls className="max-h-64 w-full rounded-xl" />
                    ) : (
                      <img
                        key={url}
                        src={url}
                        alt="Материалы о компании"
                        loading="lazy"
                        className="max-h-64 w-full rounded-xl object-cover"
                      />
                    ),
                  )}
                </div>
              </SectionCard>
            )}
          </div>
          <div className="grid content-start gap-5">
            <SectionCard>
              <h2 className="font-semibold">Контакты</h2>
              <div className="mt-4 grid gap-4 text-sm">
                {company.phone && (
                  <a href={`tel:${company.phone}`} className="flex items-center gap-3">
                    <Phone size={17} className="text-blue-600" />
                    {company.phone}
                  </a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} className="flex items-center gap-3">
                    <Mail size={17} className="text-blue-600" />
                    {company.email}
                  </a>
                )}
                {company.address && (
                  <p className="flex items-start gap-3">
                    <MapPin size={17} className="mt-0.5 text-blue-600" />
                    {company.address}
                  </p>
                )}
                {company.hours && (
                  <p className="flex items-start gap-3">
                    <Clock3 size={17} className="mt-0.5 text-blue-600" />
                    {company.hours}
                  </p>
                )}
              </div>
              {company.socials.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {company.socials.map((social) => (
                    <a
                      key={social.url}
                      target="_blank"
                      rel="noreferrer"
                      href={social.url}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium dark:bg-slate-800"
                    >
                      <Share2 size={14} />
                      {social.label}
                    </a>
                  ))}
                </div>
              )}
            </SectionCard>
            {company.requisites && (
              <SectionCard>
                <h2 className="font-semibold">Реквизиты</h2>
                <p className="mt-3 text-sm leading-6 whitespace-pre-line text-slate-600 dark:text-slate-300">
                  {company.requisites}
                </p>
              </SectionCard>
            )}
          </div>
        </div>
      )}
      {query.isLoading && <p className="text-sm text-slate-500">Загружаем информацию…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить раздел о компании.
        </p>
      )}
    </>
  );
  if (!ready)
    return <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем…</div>;
  return user ? (
    <AppShell active="/about">{content}</AppShell>
  ) : (
    <PublicSiteShell>{content}</PublicSiteShell>
  );
};
export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () =>
    createPageHead({
      title: "О сервисном центре ЕНОТ СЕРВИС в Пушкино",
      description:
        "16 лет ремонта компьютерной и мобильной техники: более 10 000 выполненных работ, обслуживание частных клиентов и организаций в Пушкино и Московской области.",
      path: "/about",
    }),
});
