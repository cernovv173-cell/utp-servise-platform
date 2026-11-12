package ru.utp.servise.ui

import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.ShopProduct

internal enum class CustomerShopTab {
    CATALOG,
    CART,
}

internal fun resolveCustomerShopTab(initialTab: String): CustomerShopTab =
    if (initialTab == "CART") CustomerShopTab.CART else CustomerShopTab.CATALOG

internal sealed interface ShopCatalogEntry {
    val title: String

    data class Product(val item: ShopProduct) : ShopCatalogEntry {
        override val title: String = item.name
    }

    data class Craft(val item: CraftItem) : ShopCatalogEntry {
        override val title: String = item.title
    }
}

internal fun combineShopCatalog(
    products: List<ShopProduct>,
    crafts: List<CraftItem>,
): List<ShopCatalogEntry> = buildList {
    products.forEach { add(ShopCatalogEntry.Product(it)) }
    crafts.filter(CraftItem::isPublished).forEach { add(ShopCatalogEntry.Craft(it)) }
}.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.title })
