import { createFileRoute } from "@tanstack/react-router";

import { ShopStorefront } from "@/features/shop/shop-storefront";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/shop")({
  component: ShopStorefront,
  head: () =>
    createPageHead({
      title: "Магазин товаров и рукоделия — ЕНОТ СЕРВИС, Пушкино",
      description:
        "Товары и готовые изделия ручной работы в магазине ЕНОТ СЕРВИС. Самовывоз из Пушкино или доставка с ручным согласованием цены и срока.",
      path: "/shop",
    }),
});
