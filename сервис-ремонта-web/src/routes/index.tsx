import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, FileText, Laptop, Newspaper, Sparkles } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { MailRuAd } from "@/components/mailru-ad";
import { MyTargetAd } from "@/components/mytarget-ad";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignCarousel } from "@/features/campaigns/campaign-banner";

import { getBanners, getNews, getOrders } from "@/lib/api";

const HomePage = () => {
  const { token, user } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: Boolean(token),
  });
  const news = useQuery({
    queryKey: ["news", token],
    queryFn: ({ signal }) => getNews(token!, signal),
    enabled: Boolean(token),
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

  return (
    <AppShell active="/">
      <PageTitle
        eyebrow="UTP SERVISE"
        title={`Здравствуйте, ${user?.displayName ?? ""}!`}
        description="Рады видеть вас в сервисе ремонта техники."
      />
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
      <CampaignCarousel
        banners={banners.data?.banners ?? []}
        placement="HOME"
        asOf={banners.dataUpdatedAt}
        className="mb-5"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {user?.role === "CUSTOMER" && (
          <Link to="/devices">
            <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <Laptop className="text-blue-600" />
              <h3 className="mt-4 font-semibold">Моя техника</h3>
              <p className="mt-1 text-sm text-slate-500">
                История ремонтов и напоминания об обслуживании
              </p>
            </SectionCard>
          </Link>
        )}
        <Link to="/orders">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <ClipboardList className="text-blue-600" />
            <h3 className="mt-4 font-semibold">Мои заявки</h3>
            <p className="mt-1 text-sm text-slate-500">
              {orders.isLoading ? "Загружаем…" : `${openOrders} активных заявок`}
            </p>
          </SectionCard>
        </Link>
        <Link to="/checks">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <FileText className="text-emerald-600" />
            <h3 className="mt-4 font-semibold">Чеки и сервисные номера</h3>
            <p className="mt-1 text-sm text-slate-500">Заказы и состав работ</p>
          </SectionCard>
        </Link>
        <Link to="/news">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <Newspaper className="text-violet-600" />
            <h3 className="mt-4 font-semibold">Новости сервиса</h3>
            <p className="mt-1 text-sm text-slate-500">Акции, объявления и обновления</p>
          </SectionCard>
        </Link>
        <Link to="/crafts">
          <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <Sparkles className="text-amber-600" />
            <h3 className="mt-4 font-semibold">Ручная работа</h3>
            <p className="mt-1 text-sm text-slate-500">Изделия и заказные варианты</p>
          </SectionCard>
        </Link>
      </div>
      <MyTargetAd />
      <MailRuAd />
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Приоритетные новости</h2>
        <Link to="/news" className="text-sm font-semibold text-blue-600">
          Все новости <span aria-hidden="true">→</span>
        </Link>
      </div>
      {news.isError && <p className="mt-4 text-sm text-rose-600">Не удалось загрузить новости.</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {featured.map((article) => (
          <SectionCard key={article.id}>
            <p className="text-xs font-semibold text-blue-600">Главная новость</p>
            <h3 className="mt-2 font-semibold">{article.title}</h3>
            <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-500">{article.content}</p>
          </SectionCard>
        ))}
        {!news.isLoading && featured.length === 0 && (
          <SectionCard className="md:col-span-3">
            <p className="text-sm text-slate-500">Пока нет приоритетных новостей.</p>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
};

export const Route = createFileRoute("/")({ component: HomePage });
