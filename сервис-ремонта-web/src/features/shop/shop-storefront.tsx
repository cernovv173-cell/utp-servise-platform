import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MapPin, Minus, PackageOpen, Plus, ShoppingBag, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { PublicAuthTrigger, PublicSiteShell } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  type ShopOrder,
  type ShopOrderStatus,
  type ShopProduct,
  createShopOrder,
  getMyShopOrders,
  getShopProductImageUrl,
  getShopProducts,
  respondToShopDeliveryOffer,
} from "@/lib/api";

import { type ShopCart, getShopCartCount, loadShopCart, setShopCartQuantity } from "./shop-cart";

const rubles = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const formatRub = (amount: number) => `${rubles.format(amount)} ₽`;

const orderStatusLabel: Record<ShopOrderStatus, string> = {
  PENDING: "Ожидает проверки",
  CONFIRMED: "Наличие подтверждено",
  COMPLETED: "Выдан",
  CANCELLED: "Отменён",
};

const deliveryAreas = [
  { value: "MOSCOW", label: "Москва" },
  { value: "MOSCOW_REGION", label: "Московская область" },
] as const;
type DeliveryAreaCode = (typeof deliveryAreas)[number]["value"];
const deliveryAreaLabel: Record<DeliveryAreaCode, string> = {
  MOSCOW: "Москва",
  MOSCOW_REGION: "Московская область",
};

const availabilityLabel = (availability: ShopProduct["availability"]) => {
  if (availability === "IN_STOCK") return "Есть в наличии";
  if (availability === "OUT_OF_STOCK") return "Нет в наличии";
  return "Наличие уточнит администратор";
};

const orderDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(date),
  );

const ProductCard = ({
  product,
  quantity,
  canOrder,
  onAdd,
}: {
  product: ShopProduct;
  quantity: number;
  canOrder: boolean;
  onAdd: () => void;
}) => (
  <article className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
    {product.imageObjectIds.length > 0 ? (
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {product.imageObjectIds.slice(0, 4).map((objectId, index) => (
          <img
            key={objectId}
            src={getShopProductImageUrl(product.id, objectId)}
            alt={`${product.name} — фото ${index + 1}`}
            loading="lazy"
            className="size-24 shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-slate-800"
          />
        ))}
      </div>
    ) : (
      <span className="mb-4 grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-cyan-200">
        <PackageOpen size={23} aria-hidden="true" />
      </span>
    )}
    <div className="min-w-0">
      <h2 className="font-semibold">{product.name}</h2>
      {product.description && (
        <p className="mt-2 line-clamp-4 text-sm leading-5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {product.description}
        </p>
      )}
      <p
        className={`mt-2 text-xs font-medium ${product.availability === "OUT_OF_STOCK" ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}
      >
        {availabilityLabel(product.availability)}
      </p>
    </div>
    <div className="mt-auto flex items-end justify-between gap-3 pt-6">
      <p className="text-xl font-bold tabular-nums">{formatRub(product.unitPriceRub)}</p>
      {canOrder && product.availability !== "OUT_OF_STOCK" ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus size={16} aria-hidden="true" />
          {quantity ? `В корзине: ${quantity}` : "В корзину"}
        </button>
      ) : (
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {product.availability === "OUT_OF_STOCK" ? "Недоступен" : "Заказ из аккаунта клиента"}
        </span>
      )}
    </div>
  </article>
);

const CustomerOrderCard = ({
  order,
  onDeliveryResponse,
  isResponding,
}: {
  order: ShopOrder;
  onDeliveryResponse: (orderId: string, accept: boolean) => void;
  isResponding: boolean;
}) => {
  const deliveryStatus =
    order.status === "PENDING" && order.deliveryMethod === "COURIER"
      ? order.deliveryOfferAcceptedAt
        ? "Условия доставки приняты"
        : order.deliveryFeeRub !== null
          ? "Нужно согласовать доставку"
          : "Уточняем доставку"
      : orderStatusLabel[order.status];
  const areaName = order.deliveryArea ? deliveryAreaLabel[order.deliveryArea] : null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Заказ #{order.id.slice(0, 8)}</p>
          <p className="mt-1 text-xs text-slate-500">{orderDate(order.createdAt)}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-cyan-200">
          {deliveryStatus}
        </span>
      </div>
      <ul className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatRub(item.quantity * item.unitPriceRub)}
            </span>
          </li>
        ))}
      </ul>
      {order.deliveryMethod === "COURIER" && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <p className="flex items-start gap-2 font-medium">
            <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {areaName}, {order.deliveryCity}, {order.deliveryAddress}
            </span>
          </p>
          {order.deliveryRequestNote && (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Пожелание: {order.deliveryRequestNote}
            </p>
          )}
          {order.deliveryFeeRub !== null && order.deliveryWindow ? (
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <p>Доставка: {formatRub(order.deliveryFeeRub)}</p>
              <p className="mt-1">Предлагаемое время: {order.deliveryWindow}</p>
              {order.status === "PENDING" && !order.deliveryOfferAcceptedAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => onDeliveryResponse(order.id, true)}
                    className="min-h-10 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Согласен, продолжить
                  </button>
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => onDeliveryResponse(order.id, false)}
                    className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-white disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    Отказаться от заказа
                  </button>
                </div>
              )}
              {order.deliveryOfferAcceptedAt && order.status === "PENDING" && (
                <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Вы согласились. Администратор проверит наличие и подтвердит заказ.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Администратор уточнит цену и срок, затем предложит условия доставки. Заказ будет
              подтверждён только после вашего согласия.
            </p>
          )}
        </div>
      )}
      <p className="mt-3 border-t border-slate-100 pt-3 text-right font-semibold dark:border-slate-800">
        Товары: {formatRub(order.totalRub)}
        {order.deliveryFeeRub !== null && (
          <span className="ml-3">Всего: {formatRub(order.totalRub + order.deliveryFeeRub)}</span>
        )}
      </p>
    </article>
  );
};

export const ShopStorefront = () => {
  const { ready, token, user } = useAuth();
  const queryClient = useQueryClient();
  const cartStorageKey = `utp-shop-cart:${user?.id ?? "guest"}`;
  const [cartState, setCartState] = useState(() => ({
    storageKey: cartStorageKey,
    cart: loadShopCart(cartStorageKey),
  }));
  const productsQuery = useQuery({
    queryKey: ["shop-products"],
    queryFn: ({ signal }) => getShopProducts(signal),
  });
  const cart = useMemo(() => {
    const currentCart =
      cartState.storageKey === cartStorageKey ? cartState.cart : loadShopCart(cartStorageKey);
    if (!productsQuery.data) return currentCart;
    const productIds = new Set(productsQuery.data.products.map(({ id }) => id));
    return Object.fromEntries(
      Object.entries(currentCart).filter(([id]) => productIds.has(id)),
    ) as ShopCart;
  }, [cartState, cartStorageKey, productsQuery.data]);
  const [customerNote, setCustomerNote] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"PICKUP" | "COURIER">("PICKUP");
  const [deliveryArea, setDeliveryArea] = useState<DeliveryAreaCode>("MOSCOW");
  const [deliveryCity, setDeliveryCity] = useState("Москва");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryRequestNote, setDeliveryRequestNote] = useState("");
  const customerOrdersQuery = useQuery({
    queryKey: ["shop-orders", token],
    queryFn: ({ signal }) => getMyShopOrders(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });
  const products = productsQuery.data?.products ?? [];
  const cartLines = products.filter((product) => Boolean(cart[product.id]));
  const cartTotal = cartLines.reduce(
    (total, product) => total + product.unitPriceRub * cart[product.id]!,
    0,
  );
  const hasUnavailableItem = cartLines.some((product) => product.availability === "OUT_OF_STOCK");

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

  const setQuantity = (productId: string, quantity: number) => {
    setCartState({
      storageKey: cartStorageKey,
      cart: setShopCartQuantity(cart, productId, quantity),
    });
  };

  const orderMutation = useMutation({
    mutationFn: () =>
      createShopOrder(token!, {
        items: cartLines.map(({ id }) => ({ catalogItemId: id, quantity: cart[id]! })),
        customerNote: customerNote.trim(),
        deliveryMethod,
        ...(deliveryMethod === "COURIER"
          ? {
              deliveryArea,
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
      setDeliveryArea("MOSCOW");
      setDeliveryCity("Москва");
      setDeliveryAddress("");
      setDeliveryRequestNote("");
      void queryClient.invalidateQueries({ queryKey: ["shop-orders", token] });
      toast.success(
        deliveryMethod === "COURIER"
          ? "Заявка на доставку отправлена. Администратор уточнит стоимость и срок."
          : "Заказ отправлен. Администратор проверит наличие.",
      );
    },
    onError: () => toast.error("Не удалось отправить заказ. Обновите товары и попробуйте ещё раз."),
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

  const canOrder = user?.role === "CUSTOMER" && Boolean(token);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем профиль…</div>
    );
  }

  const content = (
    <>
      <PageTitle
        eyebrow="ОТДЕЛЬНЫЙ МАГАЗИН"
        title="Магазин товаров"
        description="Здесь продаются товары из каталога. Запчасти и услуги для ремонта оформляются отдельно."
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
              : "Товары можно посмотреть без регистрации. Для оформления заказа потребуется войти в аккаунт клиента."}
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
        <section aria-labelledby="shop-products-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="shop-products-heading" className="text-lg font-semibold">
              Товары
            </h2>
            <button
              type="button"
              onClick={() => void productsQuery.refetch()}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-cyan-300 dark:hover:bg-blue-950/40"
            >
              Обновить каталог
            </button>
          </div>
          {productsQuery.isLoading && (
            <SectionCard>
              <p className="text-sm text-slate-500">Загружаем товары…</p>
            </SectionCard>
          )}
          {productsQuery.isError && (
            <SectionCard>
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить товары. Попробуйте обновить каталог.
              </p>
            </SectionCard>
          )}
          {!productsQuery.isLoading && !productsQuery.isError && products.length === 0 && (
            <SectionCard className="py-10 text-center">
              <ShoppingBag size={30} className="mx-auto text-blue-500" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">Товаров пока нет</h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                Когда администратор добавит и включит товары в каталоге, они появятся здесь.
              </p>
              {user?.role === "ADMIN" && (
                <Link
                  to="/catalog"
                  className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-300"
                >
                  Перейти в каталог товаров
                </Link>
              )}
            </SectionCard>
          )}
          {products.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] ?? 0}
                  canOrder={canOrder}
                  onAdd={() => setQuantity(product.id, (cart[product.id] ?? 0) + 1)}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="shop-cart-heading" className="lg:sticky lg:top-24">
          <SectionCard>
            <div className="flex items-center gap-2">
              <ShoppingCart
                size={20}
                className="text-blue-600 dark:text-cyan-300"
                aria-hidden="true"
              />
              <h2 id="shop-cart-heading" className="font-semibold">
                Корзина
              </h2>
              <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums dark:bg-slate-800">
                {getShopCartCount(cart)}
              </span>
            </div>
            {cartLines.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Добавьте товары, чтобы оформить заказ.</p>
            ) : (
              <>
                <ul className="mt-4 grid gap-3">
                  {cartLines.map((product) => (
                    <li
                      key={product.id}
                      className="border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatRub(product.unitPriceRub)} за штуку
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatRub(product.unitPriceRub * cart[product.id]!)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Уменьшить количество: ${product.name}`}
                          onClick={() => setQuantity(product.id, cart[product.id]! - 1)}
                          className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span className="min-w-6 text-center text-sm tabular-nums">
                          {cart[product.id]}
                        </span>
                        <button
                          type="button"
                          aria-label={`Увеличить количество: ${product.name}`}
                          disabled={cart[product.id]! >= 100}
                          onClick={() => setQuantity(product.id, cart[product.id]! + 1)}
                          className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                        {product.availability === "OUT_OF_STOCK" && (
                          <span className="ml-1 text-xs text-rose-600">
                            Снимите недоступный товар
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {canOrder && (
                  <fieldset className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <legend className="px-1 text-sm font-semibold">Получение заказа</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["PICKUP", "Самовывоз"],
                          ["COURIER", "Доставка"],
                        ] as const
                      ).map(([method, label]) => (
                        <label
                          key={method}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium ${deliveryMethod === method ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-cyan-200" : "border-slate-200 dark:border-slate-700"}`}
                        >
                          <input
                            type="radio"
                            name="shop-delivery-method"
                            value={method}
                            checked={deliveryMethod === method}
                            onChange={() => setDeliveryMethod(method)}
                            className="accent-blue-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {deliveryMethod === "COURIER" && (
                      <div className="mt-4 grid gap-3">
                        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                          Доставка доступна по Москве и Московской области. Администратор проверит
                          адрес, сообщит цену и срок; заказ подтвердится только после вашего
                          согласия.
                        </p>
                        <fieldset>
                          <legend className="mb-2 text-sm font-medium">
                            Регион доставки&nbsp;<span aria-hidden="true">*</span>
                          </legend>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {deliveryAreas.map((area) => (
                              <label
                                key={area.value}
                                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${deliveryArea === area.value ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-cyan-200" : "border-slate-200 dark:border-slate-700"}`}
                              >
                                <input
                                  type="radio"
                                  name="shop-delivery-area"
                                  value={area.value}
                                  checked={deliveryArea === area.value}
                                  required
                                  onChange={() => {
                                    setDeliveryArea(area.value);
                                    setDeliveryCity(area.value === "MOSCOW" ? "Москва" : "");
                                  }}
                                  className="accent-blue-600"
                                />
                                {area.label}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <label
                          className="grid gap-1 text-sm font-medium"
                          htmlFor="shop-delivery-city"
                        >
                          <span>
                            Город или населённый пункт&nbsp;<span aria-hidden="true">*</span>
                          </span>
                          <input
                            id="shop-delivery-city"
                            value={deliveryCity}
                            onChange={(event) => setDeliveryCity(event.target.value.slice(0, 120))}
                            autoComplete="address-level2"
                            maxLength={120}
                            required
                            placeholder="Например, Мытищи или Пушкино"
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                        <label
                          className="grid gap-1 text-sm font-medium"
                          htmlFor="shop-delivery-address"
                        >
                          <span>
                            Улица, дом и квартира&nbsp;<span aria-hidden="true">*</span>
                          </span>
                          <input
                            id="shop-delivery-address"
                            value={deliveryAddress}
                            onChange={(event) =>
                              setDeliveryAddress(event.target.value.slice(0, 500))
                            }
                            autoComplete="street-address"
                            maxLength={500}
                            required
                            placeholder="Улица, дом, квартира"
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                        <label
                          className="grid gap-1 text-sm font-medium"
                          htmlFor="shop-delivery-request-note"
                        >
                          Пожелания по доставке{" "}
                          <span className="font-normal text-slate-500">(необязательно)</span>
                          <textarea
                            id="shop-delivery-request-note"
                            value={deliveryRequestNote}
                            onChange={(event) =>
                              setDeliveryRequestNote(event.target.value.slice(0, 500))
                            }
                            maxLength={500}
                            rows={2}
                            placeholder="Например, домофон или удобный интервал"
                            className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                      </div>
                    )}
                  </fieldset>
                )}
                <label className="mt-4 block text-sm font-medium" htmlFor="shop-customer-note">
                  Комментарий администратору{" "}
                  <span className="font-normal text-slate-500">(необязательно)</span>
                </label>
                <textarea
                  id="shop-customer-note"
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value.slice(0, 1000))}
                  maxLength={1000}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Например, удобное время для звонка"
                />
                <p className="mt-4 flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-slate-800">
                  <span>Итого</span>
                  <span className="tabular-nums">{formatRub(cartTotal)}</span>
                </p>
                {!canOrder ? (
                  <PublicAuthTrigger
                    intent="register"
                    nextPath="/shop"
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Войти, чтобы отправить заказ
                  </PublicAuthTrigger>
                ) : (
                  <button
                    type="button"
                    disabled={
                      orderMutation.isPending ||
                      cartLines.length === 0 ||
                      hasUnavailableItem ||
                      (deliveryMethod === "COURIER" &&
                        (!deliveryCity.trim() || !deliveryAddress.trim()))
                    }
                    onClick={() => orderMutation.mutate()}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingBag size={17} aria-hidden="true" />
                    {orderMutation.isPending ? "Отправляем…" : "Отправить заказ"}
                  </button>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {deliveryMethod === "COURIER"
                    ? "Сейчас показана стоимость товаров. Администратор отдельно предложит цену и срок доставки; до вашего согласия заказ не будет подтверждён. Онлайн-оплаты нет."
                    : "Заказ ожидает подтверждения администратора. Склад резервируется только после проверки; оплату и получение согласуем отдельно, онлайн-оплаты нет."}
                </p>
              </>
            )}
          </SectionCard>
        </section>
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
              {customerOrdersQuery.data.orders.map((order) => (
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
