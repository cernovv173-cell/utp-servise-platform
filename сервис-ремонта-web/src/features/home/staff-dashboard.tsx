import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  Boxes,
  ClipboardList,
  ClipboardPenLine,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Newspaper,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignBanner } from "@/features/campaigns/campaign-banner";

import type { User } from "@/lib/api";
import { getBanners, getNews, getOrders } from "@/lib/api";

const OrderShortcut = ({
  role,
  view,
  title,
  description,
  count,
  icon: Icon,
}: {
  role: User["role"];
  view: "new" | "archived";
  title: string;
  description: string;
  count: number | null;
  icon: typeof ClipboardList;
}) => {
  const content = (
    <SectionCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="text-2xl font-semibold tabular-nums">{count === null ? "—" : count}</span>
      </div>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-[#91eaff]">
        Открыть <ArrowRight size={16} aria-hidden="true" />
      </span>
    </SectionCard>
  );

  return role === "ADMIN" ? (
    <Link to="/admin/orders" search={{ view }} className="block h-full">
      {content}
    </Link>
  ) : (
    <Link to="/orders" search={{ view }} className="block h-full">
      {content}
    </Link>
  );
};

const DashboardLink = ({
  to,
  title,
  description,
  icon: Icon,
}: {
  to:
    | "/admin/order-editing"
    | "/advertising"
    | "/admin"
    | "/news"
    | "/crafts"
    | "/catalog"
    | "/about"
    | "/support"
    | "/chats";
  title: string;
  description: string;
  icon: typeof ClipboardPenLine;
}) => (
  <Link to={to} className="block">
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 transition hover:border-blue-300 hover:bg-white dark:border-[#293a65] dark:bg-[#101a34]/70 dark:hover:border-[#5675ff]/60 dark:hover:bg-[#142144]">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-[#1b2b50] dark:text-[#91eaff]">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
    </div>
  </Link>
);

export const StaffDashboard = ({ user }: { user: User }) => {
  const { token } = useAuth();
  const isAdmin = user.role === "ADMIN";
  const { data: activeOrders, isLoading: loadingActive } = useQuery({
    queryKey: ["orders", token, "active"],
    queryFn: ({ signal }) => getOrders(token!, signal, "active"),
    enabled: Boolean(token),
  });
  const { data: archivedOrders, isLoading: loadingArchive } = useQuery({
    queryKey: ["orders", token, "archived"],
    queryFn: ({ signal }) => getOrders(token!, signal, "archived"),
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
  });
  const currentTimestamp = news.dataUpdatedAt;
  const visibleArticles = (news.data?.articles ?? []).filter((article) => {
    return (
      article.isPublished &&
      (!article.startsAt || new Date(article.startsAt).getTime() <= currentTimestamp) &&
      (!article.endsAt || new Date(article.endsAt).getTime() > currentTimestamp)
    );
  });
  const openOrders = (activeOrders?.orders ?? []).filter(
    (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
  );
  const newOrders = openOrders.filter((order) => order.status === "REQUESTED").length;

  return (
    <>
      <PageTitle
        eyebrow={isAdmin ? "РАБОЧЕЕ МЕСТО · АДМИНИСТРАТОР" : "РАБОЧЕЕ МЕСТО · МАСТЕР"}
        title={`Здравствуйте, ${user.displayName}!`}
        description={
          isAdmin
            ? "Заявки, новости сервиса и инструменты управления — на одной главной странице."
            : "Ваши назначенные ремонты, каталог и история работ — в одном месте."
        }
        action={
          <Link
            to={isAdmin ? "/admin/orders" : "/orders"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <ClipboardList size={17} aria-hidden="true" />
            {isAdmin ? "Все заявки" : "Мои заявки"}
          </Link>
        }
      />

      <section aria-labelledby="order-shortcuts-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="order-shortcuts-title" className="text-lg font-semibold">
              Мои заявки
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isAdmin
                ? "Новые обращения, текущие заказы и архив всего сервиса."
                : "Новые назначения и архив ваших ремонтов."}
            </p>
          </div>
          {isAdmin && (
            <Link
              to="/admin/order-editing"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-blue-700 dark:border-slate-700 dark:text-blue-300"
            >
              <ClipboardPenLine size={16} aria-hidden="true" /> Редактировать заявку
            </Link>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <OrderShortcut
            role={user.role}
            view="new"
            title="Новые заявки"
            description="Откройте заказы, ожидающие обработки."
            count={loadingActive ? null : newOrders}
            icon={ClipboardList}
          />
          <OrderShortcut
            role={user.role}
            view="archived"
            title="Архив заявок"
            description="Найдите сохранённые заявки и завершённые заказы."
            count={loadingArchive ? null : (archivedOrders?.orders.length ?? 0)}
            icon={Archive}
          />
        </div>
        {isAdmin && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Открыто заявок:{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {loadingActive ? "…" : openOrders.length}
            </span>
          </p>
        )}
      </section>

      {(banners.data?.banners ?? [])
        .filter((banner) => banner.placements.includes("HOME"))
        .map((banner) => (
          <CampaignBanner key={banner.id} banner={banner} className="mt-6" />
        ))}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <section aria-labelledby="service-news-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-[#77e7ff]">
                ОБНОВЛЕНИЯ
              </p>
              <h2 id="service-news-title" className="mt-1 text-lg font-semibold">
                Новости сервиса
              </h2>
            </div>
            <Link to="/news" className="text-sm font-semibold text-blue-700 dark:text-[#91eaff]">
              {isAdmin ? "Добавить или изменить" : "Все новости"} <span aria-hidden="true">→</span>
            </Link>
          </div>
          {news.isError && (
            <SectionCard>
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить новости сервиса.
              </p>
            </SectionCard>
          )}
          {news.isLoading && <p className="text-sm text-slate-500">Загружаем новости…</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {visibleArticles.slice(0, 4).map((article) => (
              <SectionCard key={article.id} className="h-full">
                {article.isFeatured && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    Важное
                  </span>
                )}
                <h3 className="mt-2 font-semibold">{article.title}</h3>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {article.content}
                </p>
              </SectionCard>
            ))}
            {!news.isLoading && !news.isError && visibleArticles.length === 0 && (
              <SectionCard className="md:col-span-2">
                <p className="text-sm text-slate-500">
                  Пока нет опубликованных новостей.
                  {isAdmin ? " Создайте первую в разделе «Новости сервиса»." : ""}
                </p>
              </SectionCard>
            )}
          </div>
        </section>

        <section aria-labelledby="service-tools-title">
          <h2 id="service-tools-title" className="mb-3 text-lg font-semibold">
            Разделы сервиса
          </h2>
          <div className="grid gap-2">
            <DashboardLink
              to="/crafts"
              title="Ручная работа"
              description="Изделия и заказные варианты"
              icon={Sparkles}
            />
            <DashboardLink
              to="/catalog"
              title="Каталог ремонта"
              description="Работы и запасные части"
              icon={Boxes}
            />
            <DashboardLink
              to="/chats"
              title="Чаты по заявкам"
              description="Переписка с клиентами и мастерами"
              icon={MessageCircle}
            />
            {isAdmin && (
              <>
                <DashboardLink
                  to="/advertising"
                  title="Реклама"
                  description="Баннеры и места показа"
                  icon={Megaphone}
                />
                <DashboardLink
                  to="/support"
                  title="Поддержка"
                  description="Ответы на сообщения клиентов"
                  icon={LifeBuoy}
                />
                <DashboardLink
                  to="/admin"
                  title="Панель администратора"
                  description="Управление сервисом"
                  icon={UsersRound}
                />
              </>
            )}
            {!isAdmin && (
              <DashboardLink
                to="/news"
                title="Новости сервиса"
                description="Объявления и обновления"
                icon={Newspaper}
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
};
