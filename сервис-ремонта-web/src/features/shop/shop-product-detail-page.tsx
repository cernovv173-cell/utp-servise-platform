import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, PackageOpen, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { PublicAuthTrigger, PublicSiteShell } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";
import { craftItemImageIds } from "@/features/crafts/craft-item-images";

import {
  type ShopCraftItem,
  type ShopProduct,
  getShopCraftImageUrl,
  getShopCraftItems,
  getShopProductImageUrl,
  getShopProducts,
} from "@/lib/api";

import { loadShopCart, setShopCartQuantity } from "./shop-cart";
import { formatShopRub } from "./shop-format";

type ShopItem = { kind: "product"; item: ShopProduct } | { kind: "craft"; item: ShopCraftItem };

const emptyProducts: ShopProduct[] = [];
const emptyCrafts: ShopCraftItem[] = [];

const ShopProductDetailPage = ({ kind, itemId }: { kind: string; itemId: string }) => {
  const { ready, user } = useAuth();
  const productQuery = useQuery({
    queryKey: ["shop-products"],
    queryFn: ({ signal }) => getShopProducts(signal),
  });
  const craftQuery = useQuery({
    queryKey: ["shop-craft-items"],
    queryFn: ({ signal }) => getShopCraftItems(signal),
  });
  const products = productQuery.data?.products ?? emptyProducts;
  const crafts = craftQuery.data?.items ?? emptyCrafts;
  const item = useMemo<ShopItem | undefined>(() => {
    if (kind === "product") {
      const product = products.find((entry) => entry.id === itemId);
      return product ? { kind: "product", item: product } : undefined;
    }
    if (kind === "craft") {
      const craft = crafts.find((entry) => entry.id === itemId);
      return craft ? { kind: "craft", item: craft } : undefined;
    }
    return undefined;
  }, [crafts, itemId, kind, products]);
  const storageKey = `utp-shop-cart:${user?.id ?? "guest"}`;
  const [cartState, setCartState] = useState(() => ({
    storageKey,
    cart: loadShopCart(storageKey),
  }));
  const cart = cartState.storageKey === storageKey ? cartState.cart : loadShopCart(storageKey);
  const cartKey = item?.kind === "craft" ? `craft:${item.item.id}` : item?.item.id;
  const quantity = cartKey ? (cart[cartKey] ?? 0) : 0;
  const isLoading = productQuery.isLoading || craftQuery.isLoading;
  const hasError = productQuery.isError || craftQuery.isError;
  const canOrder = user?.role === "CUSTOMER";
  const stockLimit =
    item?.kind === "craft"
      ? item.item.stockQuantity
      : item?.kind === "product" && item.item.availability === "OUT_OF_STOCK"
        ? 0
        : 100;
  const isAvailable =
    stockLimit > quantity &&
    (item?.kind !== "product" || item.item.availability !== "OUT_OF_STOCK");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  const handleAddToCart = () => {
    if (!item || !cartKey || !isAvailable) return;
    setCartState({
      storageKey,
      cart: setShopCartQuantity(cart, cartKey, Math.min(quantity + 1, stockLimit)),
    });
    toast.success("Добавлено в корзину.");
  };

  const content = (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <Link
        to="/shop"
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-cyan-300 dark:hover:bg-blue-950/40"
      >
        <ArrowLeft size={17} aria-hidden="true" />В магазин
      </Link>

      {isLoading && !item && (
        <SectionCard>
          <p className="text-sm text-slate-500">Загружаем карточку товара…</p>
        </SectionCard>
      )}
      {hasError && !item && (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
            Не удалось загрузить товар. Вернитесь в магазин и попробуйте открыть карточку ещё раз.
          </p>
        </SectionCard>
      )}
      {!isLoading && !hasError && !item && (
        <SectionCard>
          <p className="font-semibold">Товар не найден или больше не опубликован.</p>
          <Link
            to="/shop"
            className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-300"
          >
            Вернуться в магазин
          </Link>
        </SectionCard>
      )}

      {item && (
        <>
          <PageTitle
            eyebrow={item.kind === "craft" ? "ГОТОВОЕ ИЗДЕЛИЕ · РУЧНАЯ РАБОТА" : "МАГАЗИН"}
            title={item.kind === "product" ? item.item.name : item.item.title}
            description="Подробная информация о товаре и его наличии."
          />

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <ProductGallery key={`${item.kind}:${item.item.id}`} item={item} />

            <SectionCard className="lg:sticky lg:top-6">
              <p className="text-3xl font-bold tabular-nums">
                {formatShopRub(
                  item.kind === "product" ? item.item.unitPriceRub : item.item.priceRub,
                )}
              </p>
              <p
                className={`mt-3 text-sm font-semibold ${isAvailable ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}
              >
                {item.kind === "product"
                  ? item.item.availability === "IN_STOCK"
                    ? "Есть в наличии"
                    : item.item.availability === "OUT_OF_STOCK"
                      ? "Нет в наличии"
                      : "Наличие уточнит администратор"
                  : item.item.stockQuantity > 0
                    ? `Готово сейчас · ${item.item.stockQuantity} шт.`
                    : "Пока нет готовых экземпляров"}
              </p>

              {canOrder ? (
                <>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!isAvailable}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                  >
                    <ShoppingBag size={18} aria-hidden="true" />
                    {isAvailable
                      ? quantity
                        ? `Добавить ещё · в корзине ${quantity}`
                        : "В корзину"
                      : "Недоступно для заказа"}
                  </button>
                  {quantity > 0 && (
                    <Link
                      to="/shop"
                      className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                    >
                      Открыть корзину и оформить заказ
                    </Link>
                  )}
                </>
              ) : user ? (
                <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  Заказ из аккаунта клиента. Войдите под клиентской учётной записью, чтобы добавить
                  товар в корзину.
                </p>
              ) : (
                <PublicAuthTrigger
                  intent="register"
                  nextPath={`/product/${kind}/${itemId}`}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Войти или зарегистрироваться для заказа
                </PublicAuthTrigger>
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Заказ отправляется как заявка. Наличие подтвердит администратор; онлайн-оплаты нет.
              </p>
            </SectionCard>
          </div>

          <SectionCard className="mt-5">
            <h2 className="text-lg font-semibold">Описание</h2>
            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
              {item.kind === "product"
                ? item.item.description?.trim() || "Описание для этого товара пока не добавлено."
                : item.item.description.trim() || "Готовое изделие ручной работы."}
            </p>
            {item.kind === "craft" && item.item.customOrderAvailable && (
              <Link
                to="/crafts"
                className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-cyan-300 dark:hover:bg-slate-900"
              >
                Обсудить изготовление на заказ
              </Link>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );

  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем профиль…</div>
    );
  return user ? (
    <AppShell active="/shop">{content}</AppShell>
  ) : (
    <PublicSiteShell>{content}</PublicSiteShell>
  );
};

const ProductGallery = ({ item }: { item: ShopItem }) => {
  const images =
    item.kind === "product"
      ? item.item.imageObjectIds.slice(0, 3).map((objectId, index) => ({
          objectId,
          label: `${item.item.name} — фото ${index + 1}`,
          src: getShopProductImageUrl(item.item.id, objectId),
        }))
      : craftItemImageIds(item.item).map((objectId, index) => ({
          objectId,
          label: `${item.item.title} — фото ${index + 1}`,
          src: getShopCraftImageUrl(item.item.id, objectId),
        }));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex] ?? images[0];

  return (
    <SectionCard>
      {selectedImage ? (
        <img
          src={selectedImage.src}
          alt={selectedImage.label}
          className="aspect-square w-full rounded-2xl bg-slate-100 object-contain sm:max-h-[34rem] dark:bg-slate-900"
        />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
          <div className="text-center">
            <PackageOpen size={42} className="mx-auto" aria-hidden="true" />
            <p className="mt-2 text-sm">Фото пока не добавлено</p>
          </div>
        </div>
      )}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Фотографии товара">
          {images.map((image, index) => (
            <button
              key={image.objectId}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Показать фото ${index + 1}`}
              aria-pressed={selectedIndex === index}
              className={`shrink-0 rounded-xl border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selectedIndex === index ? "border-blue-600" : "border-transparent"}`}
            >
              <img
                src={image.src}
                alt=""
                loading="lazy"
                className="size-16 rounded-lg bg-slate-100 object-cover dark:bg-slate-900"
              />
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

export default ShopProductDetailPage;
