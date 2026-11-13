import { createFileRoute } from "@tanstack/react-router";

import ShopProductDetailPage from "@/features/shop/shop-product-detail-page";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/product/$kind/$itemId")({
  component: ShopItemRoute,
  head: ({ params }) =>
    createPageHead({
      title: "Карточка товара — ЕНОТ СЕРВИС",
      description: "Подробная информация о товаре и готовом изделии ручной работы в магазине.",
      path: `/product/${params.kind}/${params.itemId}`,
    }),
});

function ShopItemRoute() {
  const { kind, itemId } = Route.useParams();
  return <ShopProductDetailPage kind={kind} itemId={itemId} />;
}
