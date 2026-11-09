import { createFileRoute } from "@tanstack/react-router";

import { ShopStorefront } from "@/features/shop/shop-storefront";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/shop")({
  component: ShopStorefront,
  head: () =>
    createPageHead({
      title: "Магазин техники и аксессуаров — ЕНОТ СЕРВИС, Пушкино",
      description:
        "Техника и аксессуары в магазине ЕНОТ СЕРВИС: наличие подтверждает администратор, заказ без онлайн-оплаты, получение в Пушкино.",
      path: "/shop",
    }),
});
