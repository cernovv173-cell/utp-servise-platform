import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Sparkles, UsersRound } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { MailRuAd } from "@/components/mailru-ad";
import { MyTargetAd } from "@/components/mytarget-ad";
import { RaccoonIcon } from "@/components/raccoon-icon";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignCarousel } from "@/features/campaigns/campaign-banner";
import { FeaturedNewsCarousel } from "@/features/news/featured-news-carousel";
import { TechnologyFactCard } from "@/features/news/technology-fact-card";
import { HomeReviewShowcase } from "@/features/public/home-review-showcase";
import { PublicHome } from "@/features/public/public-home";
import { SeasonalThemeControl } from "@/features/seasonal/seasonal-theme-control";

import { getBanners, getNews, getOrders } from "@/lib/api";

const HomePage = () => {
  const { ready, token, user } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: Boolean(token),
  });
  const news = useQuery({
    queryKey: ["news", token],
    queryFn: ({ signal }) => getNews(token!, signal),
    enabled: Boolean(token),
    refetchInterval: (currentQuery) => {
      const nextUpdateAt = currentQuery.state.data?.technologyFact?.nextUpdateAt;
      if (!nextUpdateAt) return false;
      return Math.max(1_000, Date.parse(nextUpdateAt) - Date.now());
    },
    refetchOnWindowFocus: true,
  });
  const banners = useQuery({
    queryKey: ["banners", token],
    queryFn: ({ signal }) => getBanners(token!, signal),
    enabled: Boolean(token),
    refetchInterval: 10_000,
  });
  const featured = (news.data?.articles ?? []).filter((article) => article.isFeatured).slice(0, 3);
  const openOrders = (orders.data?.orders ?? []).filter(
    (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
  ).length;

  if (ready && !user) return <PublicHome />;

  return (
    <AppShell active="/">
      <PageTitle
        eyebrow="UTP SERVISE"
        title={`Здравствуйте, ${user?.displayName ?? ""}!`}
        description="Рады видеть вас в сервисе ремонта техники."
      />
      {user?.role === "ADMIN" && token && <SeasonalThemeControl token={token} />}
      <SectionCard className="mb-6 overflow-hidden border-0 bg-gradient-to-r from-blue-600 to-sky-500 text-white">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-100">
              <Sparkles size={16} />
              Ваш сервис — в одном месте
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Что нужно починить?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50">
              Оставьте заявку, следите за статусом ремонта и получайте новости сервиса.
            </p>
          </div>
          <Link
            to="/orders"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-blue-700 hover:bg-blue-50"
          >
            Создать заявку <ArrowRight size={17} />
          </Link>
        </div>
      </SectionCard>
      {news.data?.technologyFact && <TechnologyFactCard fact={news.data.technologyFact} />}
      <FeaturedNewsCarousel articles={featured} isLoading={news.isLoading} isError={news.isError} />
      <CampaignCarousel
        banners={banners.data?.banners ?? []}
        placement="HOME"
        asOf={banners.dataUpdatedAt}
        className="mb-5"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {user?.role === "ADMIN" && (
          <Link to="/admin/customers">
            <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <UsersRound size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">База клиентов</h3>
              <p className="mt-1 text-sm text-slate-500">Управление клиентскими профилями</p>
            </SectionCard>
          </Link>
        )}
        {user?.role === "ADMIN" && (
          <Link to="/admin/shop-orders">
            <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ShoppingBag size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">Заказы магазина</h3>
              <p className="mt-1 text-sm text-slate-500">Проверка наличия и выдача товаров</p>
            </SectionCard>
          </Link>
        )}
        {user?.role === "CUSTOMER" && (
          <Link to="/shop">
            <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ShoppingBag size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">Магазин товаров</h3>
              <p className="mt-1 text-sm text-slate-500">
                Отдельно от запчастей и заявок на ремонт
              </p>
            </SectionCard>
          </Link>
        )}
        {user?.role === "CUSTOMER" && (
          <Link to="/devices">
            <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <RaccoonIcon
                motion="peek"
                className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-2xl dark:bg-blue-950/60"
              />
              <h3 className="mt-4 font-semibold">Моя техника</h3>
              <p className="mt-1 text-sm text-slate-500">
                История ремонтов и напоминания об обслуживании
              </p>
            </SectionCard>
          </Link>
        )}
        <Link to="/orders">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <RaccoonIcon
              motion="bounce"
              className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-2xl dark:bg-sky-950/60"
            />
            <h3 className="mt-4 font-semibold">Мои заявки</h3>
            <p className="mt-1 text-sm text-slate-500">
              {orders.isLoading ? "Загружаем…" : `${openOrders} активных заявок`}
            </p>
          </SectionCard>
        </Link>
        <Link to="/checks">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <RaccoonIcon
              motion="wiggle"
              className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-2xl dark:bg-emerald-950/40"
            />
            <h3 className="mt-4 font-semibold">Чеки и сервисные номера</h3>
            <p className="mt-1 text-sm text-slate-500">Заказы и состав работ</p>
          </SectionCard>
        </Link>
        <Link to="/news">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <RaccoonIcon
              motion="bounce"
              className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-2xl dark:bg-violet-950/50"
            />
            <h3 className="mt-4 font-semibold">Новости сервиса</h3>
            <p className="mt-1 text-sm text-slate-500">Акции, объявления и обновления</p>
          </SectionCard>
        </Link>
        <Link to="/crafts">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <RaccoonIcon
              motion="peek"
              className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-2xl dark:bg-amber-950/40"
            />
            <h3 className="mt-4 font-semibold">Ручная работа</h3>
            <p className="mt-1 text-sm text-slate-500">Изделия и заказные варианты</p>
          </SectionCard>
        </Link>
      </div>
      <HomeReviewShowcase />
      <MyTargetAd />
      <MailRuAd />
    </AppShell>
  );
};

export const Route = createFileRoute("/")({ component: HomePage });
