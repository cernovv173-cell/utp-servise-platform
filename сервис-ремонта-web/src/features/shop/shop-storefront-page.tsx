import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { PublicAuthTrigger, PublicSiteShell } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  type ShopCraftItem,
  type ShopOrder,
  type ShopProduct,
  createShopOrder,
  getMyShopOrders,
  getShopCraftItems,
  getShopProducts,
  respondToShopDeliveryOffer,
} from "@/lib/api";

import { type ShopCart, getShopCartCount, loadShopCart, setShopCartQuantity } from "./shop-cart";
import { combineShopCatalog } from "./shop-catalog";
import { type ShopCheckoutLine, ShopCheckoutPanel } from "./shop-checkout-panel";
import { CraftCard, CustomerOrderCard, ProductCard } from "./shop-storefront-items";

const emptyProducts: ShopProduct[] = [];
const emptyCrafts: ShopCraftItem[] = [];

type StoreCartLine = ShopCheckoutLine & {
  kind: "PRODUCT" | "CRAFT";
  id: string;
};

const ShopStorefrontPage = () => {
  const { ready, token, user } = useAuth();
  const queryClient = useQueryClient();
  const cartStorageKey = `utp-shop-cart:${user?.id ?? "guest"}`;
  const [cartState, setCartState] = useState(() => ({
    storageKey: cartStorageKey,
    cart: loadShopCart(cartStorageKey),
  }));
  const [customerNote, setCustomerNote] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"PICKUP" | "COURIER">("PICKUP");
  const [deliveryCity, setDeliveryCity] = useState("Пушкино");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryRequestNote, setDeliveryRequestNote] = useState("");
  const productsQuery = useQuery({
    queryKey: ["shop-products"],
    queryFn: ({ signal }) => getShopProducts(signal),
  });
  const craftsQuery = useQuery({
    queryKey: ["shop-craft-items"],
    queryFn: ({ signal }) => getShopCraftItems(signal),
  });
  const customerOrdersQuery = useQuery({
    queryKey: ["shop-orders", token],
    queryFn: ({ signal }) => getMyShopOrders(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });
  const products = productsQuery.data?.products ?? emptyProducts;
  const crafts = craftsQuery.data?.items ?? emptyCrafts;
  const catalogItems = useMemo(() => combineShopCatalog(products, crafts), [crafts, products]);
  const isCatalogLoading = productsQuery.isLoading || craftsQuery.isLoading;
  const hasCatalogError = productsQuery.isError || craftsQuery.isError;
  const refreshCatalog = () => {
    void productsQuery.refetch();
    void craftsQuery.refetch();
  };
  const cart = useMemo(() => {
    const storedCart =
      cartState.storageKey === cartStorageKey ? cartState.cart : loadShopCart(cartStorageKey);
    if (!productsQuery.isSuccess || !craftsQuery.isSuccess) return storedCart;
    const validKeys = new Set([
      ...products.map(({ id }) => id),
      ...crafts.map(({ id }) => `craft:${id}`),
    ]);
    return Object.fromEntries(
      Object.entries(storedCart).filter(([key]) => validKeys.has(key)),
    ) as ShopCart;
  }, [cartState, cartStorageKey, crafts, craftsQuery.isSuccess, products, productsQuery.isSuccess]);
  const cartLines = useMemo<StoreCartLine[]>(() => {
    const productLines = products.flatMap((product) => {
      const quantity = cart[product.id];
      if (!quantity) return [];
      return [
        {
          key: product.id,
          id: product.id,
          kind: "PRODUCT" as const,
          title: product.name,
          unitPriceRub: product.unitPriceRub,
          quantity,
          availability: product.availability,
          availableQuantity: null,
        },
      ];
    });
    const craftLines = crafts.flatMap((item) => {
      const key = `craft:${item.id}`;
      const quantity = cart[key];
      if (!quantity) return [];
      return [
        {
          key,
          id: item.id,
          kind: "CRAFT" as const,
          title: item.title,
          unitPriceRub: item.priceRub,
          quantity,
          availability: item.stockQuantity > 0 ? ("IN_STOCK" as const) : ("OUT_OF_STOCK" as const),
          availableQuantity: item.stockQuantity,
        },
      ];
    });
    return [...productLines, ...craftLines];
  }, [cart, crafts, products]);
  const cartTotal = cartLines.reduce((total, line) => total + line.unitPriceRub * line.quantity, 0);
  const hasUnavailableItem = cartLines.some(
    (line) =>
      line.availability === "OUT_OF_STOCK" ||
      (line.availableQuantity !== null && line.quantity > line.availableQuantity),
  );
  const canOrder = user?.role === "CUSTOMER" && Boolean(token);

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

  const setQuantity = (key: string, quantity: number) => {
    const line = cartLines.find((entry) => entry.key === key);
    const limit = line?.availableQuantity ?? 100;
    setCartState({
      storageKey: cartStorageKey,
      cart: setShopCartQuantity(cart, key, Math.min(quantity, limit)),
    });
  };

  const orderMutation = useMutation({
    mutationFn: () =>
      createShopOrder(token!, {
        items: cartLines.map((line) =>
          line.kind === "CRAFT"
            ? { craftItemId: line.id, quantity: line.quantity }
            : { catalogItemId: line.id, quantity: line.quantity },
        ),
        customerNote: customerNote.trim(),
        deliveryMethod,
        ...(deliveryMethod === "COURIER"
          ? {
              deliveryArea: "MOSCOW_REGION" as const,
              deliveryCity: deliveryCity.trim(),
              deliveryAddress: deliveryAddress.trim(),
              deliveryRequestNote: deliveryRequestNote.trim(),
            }
          : {}),
      }),
    onSuccess: () => {
      setCartState({ storageKey: cartStorageKey, cart: {} });
      setCustomerNote("");
      setDeliveryMethod("PICKUP");
      setDeliveryCity("Пушкино");
      setDeliveryAddress("");
      setDeliveryRequestNote("");
      void queryClient.invalidateQueries({ queryKey: ["shop-orders", token] });
      toast.success(
        deliveryMethod === "COURIER"
          ? "Заявка на доставку отправлена. Администратор проверит адрес и предложит цену и срок."
          : "Заказ отправлен. Администратор проверит наличие.",
      );
    },
    onError: () =>
      toast.error("Не удалось отправить заказ. Обновите каталог и попробуйте ещё раз."),
  });

  const deliveryResponseMutation = useMutation({
    mutationFn: ({ orderId, accept }: { orderId: string; accept: boolean }) =>
      respondToShopDeliveryOffer(token!, orderId, accept),
    onSuccess: (_result, { accept }) => {
      void queryClient.invalidateQueries({ queryKey: ["shop-orders", token] });
      toast.success(accept ? "Согласие отправлено администратору." : "Заказ отменён.");
    },
    onError: () => toast.error("Не удалось отправить ответ. Обновите список заказов."),
  });

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем профиль…</div>
    );
  }

  const content = (
    <>
      <PageTitle
        eyebrow="МАГАЗИН"
        title="Товары и ручная работа"
        description="Покупайте готовые изделия в общей корзине. Изготовление по индивидуальному запросу обсудим отдельно."
        action={
          user?.role === "ADMIN" ? (
            <Link
              to="/admin/shop-orders"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              Подтверждение заказов
            </Link>
          ) : undefined
        }
      />

      {user?.role !== "CUSTOMER" && (
        <SectionCard className="mb-5 flex flex-wrap items-center justify-between gap-4 border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-200">
            {user
              ? "Просматривать витрину можно без ограничений. Заказ оформляется из аккаунта клиента."
              : "Каталог можно посмотреть без регистрации. Для заказа потребуется аккаунт клиента."}
          </p>
          {!user && (
            <PublicAuthTrigger
              intent="register"
              nextPath="/shop"
              className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Войти или зарегистрироваться
            </PublicAuthTrigger>
          )}
        </SectionCard>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <section aria-labelledby="shop-section-heading">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="shop-section-heading" className="text-lg font-semibold">
                Каталог магазина
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Готовые товары и изделия ручной работы собраны вместе.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshCatalog}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-cyan-300 dark:hover:bg-blue-950/40"
            >
              Обновить каталог
            </button>
          </div>
          {catalogItems.length === 0 && isCatalogLoading && (
            <SectionCard>
              <p className="text-sm text-slate-500">Загружаем каталог…</p>
            </SectionCard>
          )}
          {hasCatalogError && (
            <SectionCard className="mb-3">
              <p role="alert" className="text-sm text-rose-600">
                {productsQuery.isError && craftsQuery.isError
                  ? "Не удалось загрузить каталог. Попробуйте обновить его."
                  : productsQuery.isError
                    ? "Не удалось загрузить обычные товары; показываем доступные изделия ручной работы."
                    : "Не удалось загрузить изделия ручной работы; показываем доступные товары."}
              </p>
            </SectionCard>
          )}
          {catalogItems.length === 0 && !isCatalogLoading && !hasCatalogError && (
            <SectionCard className="py-10 text-center">
              <ShoppingBag size={30} className="mx-auto text-blue-500" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">Пока нет опубликованных товаров</h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                Когда в магазин добавят товары или готовые изделия ручной работы, они появятся
                здесь.
              </p>
              {user?.role === "ADMIN" && (
                <div className="mt-4 flex flex-wrap justify-center gap-4">
                  <Link
                    to="/catalog"
                    className="text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-300"
                  >
                    Каталог товаров
                  </Link>
                  <Link
                    to="/crafts"
                    className="text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-300"
                  >
                    Изделия ручной работы
                  </Link>
                </div>
              )}
            </SectionCard>
          )}
          {catalogItems.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {catalogItems.map((entry) =>
                entry.kind === "PRODUCT" ? (
                  <ProductCard
                    key={`product:${entry.product.id}`}
                    product={entry.product}
                    quantity={cart[entry.product.id] ?? 0}
                    canOrder={canOrder}
                    onAdd={() => setQuantity(entry.product.id, (cart[entry.product.id] ?? 0) + 1)}
                  />
                ) : (
                  <CraftCard
                    key={`craft:${entry.craft.id}`}
                    item={entry.craft}
                    quantity={cart[`craft:${entry.craft.id}`] ?? 0}
                    canOrder={canOrder}
                    onAdd={() =>
                      setQuantity(
                        `craft:${entry.craft.id}`,
                        (cart[`craft:${entry.craft.id}`] ?? 0) + 1,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
          <SectionCard className="mt-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Нужна вещь по индивидуальному запросу? Готовые изделия продаются в этом каталоге, а
              цену и срок изготовления под заказ согласуем отдельно.
            </p>
            <Link
              to="/crafts"
              className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-300"
            >
              Обсудить изготовление на заказ
            </Link>
          </SectionCard>
        </section>

        <ShopCheckoutPanel
          lines={cartLines}
          cartCount={getShopCartCount(cart)}
          subtotal={cartTotal}
          hasUnavailableItem={hasUnavailableItem}
          canOrder={canOrder}
          busy={orderMutation.isPending}
          deliveryMethod={deliveryMethod}
          onDeliveryMethodChange={setDeliveryMethod}
          deliveryCity={deliveryCity}
          onDeliveryCityChange={setDeliveryCity}
          deliveryAddress={deliveryAddress}
          onDeliveryAddressChange={setDeliveryAddress}
          deliveryRequestNote={deliveryRequestNote}
          onDeliveryRequestNoteChange={setDeliveryRequestNote}
          customerNote={customerNote}
          onCustomerNoteChange={setCustomerNote}
          onSetQuantity={setQuantity}
          onSubmit={() => orderMutation.mutate()}
        />
      </div>

      {user?.role === "CUSTOMER" && (
        <section className="mt-8" aria-labelledby="my-shop-orders-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="my-shop-orders-heading" className="text-lg font-semibold">
              Мои заказы магазина
            </h2>
            <button
              type="button"
              onClick={() => void customerOrdersQuery.refetch()}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-cyan-300 dark:hover:bg-blue-950/40"
            >
              Обновить
            </button>
          </div>
          {customerOrdersQuery.isLoading && (
            <SectionCard>
              <p className="text-sm text-slate-500">Загружаем заказы…</p>
            </SectionCard>
          )}
          {customerOrdersQuery.isError && (
            <SectionCard>
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить заказы магазина.
              </p>
            </SectionCard>
          )}
          {!customerOrdersQuery.isLoading &&
            !customerOrdersQuery.isError &&
            customerOrdersQuery.data?.orders.length === 0 && (
              <SectionCard>
                <p className="text-sm text-slate-500">Пока нет заказов магазина.</p>
              </SectionCard>
            )}
          {customerOrdersQuery.data?.orders.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {customerOrdersQuery.data.orders.map((order: ShopOrder) => (
                <CustomerOrderCard
                  key={order.id}
                  order={order}
                  onDeliveryResponse={(orderId, accept) =>
                    deliveryResponseMutation.mutate({ orderId, accept })
                  }
                  isResponding={deliveryResponseMutation.isPending}
                />
              ))}
            </div>
          ) : null}
        </section>
      )}
    </>
  );

  return user ? (
    <AppShell active="/shop">{content}</AppShell>
  ) : (
    <PublicSiteShell>{content}</PublicSiteShell>
  );
};

export default ShopStorefrontPage;
