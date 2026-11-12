import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CraftsWorkspace } from "@/features/crafts/crafts-workspace";
import { ShopOrdersManagement } from "@/features/shop/shop-orders-management";

const AdminShopOrdersPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"ORDERS" | "CRAFTS">("ORDERS");
  return (
    <AppShell active="/admin/shop-orders">
      <PageTitle
        eyebrow="МАГАЗИН"
        title="Магазин и рукоделие"
        description="Заказы готовых товаров и управление изделиями ручной работы — в одном разделе."
      />
      {user?.role === "ADMIN" ? (
        <>
          <div
            className="mb-5 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Управление магазином"
          >
            {(
              [
                ["ORDERS", "Заказы магазина"],
                ["CRAFTS", "Рукоделие"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${activeTab === tab ? "bg-blue-600 text-white" : "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {activeTab === "ORDERS" ? (
            <div role="tabpanel" aria-label="Заказы магазина">
              <ShopOrdersManagement />
            </div>
          ) : (
            <div role="tabpanel" aria-label="Рукоделие">
              <CraftsWorkspace embedded />
            </div>
          )}
        </>
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/shop-orders")({ component: AdminShopOrdersPage });
