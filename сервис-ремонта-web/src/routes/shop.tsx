import { createFileRoute } from "@tanstack/react-router";

import { ShopStorefront } from "@/features/shop/shop-storefront";

export const Route = createFileRoute("/shop")({ component: ShopStorefront });
