package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.ShopProduct

class ShopCatalogItemsTest {
    @Test
    fun `mixed catalog contains products and published handmade items together`() {
        val catalog = combineShopCatalog(
            products = listOf(
                ShopProduct("product-1", "Зарядное устройство", 100, "IN_STOCK"),
                ShopProduct("product-2", "Чехол", 200, "IN_STOCK"),
            ),
            crafts = listOf(
                craft(id = "craft-1", title = "Брелок ручной работы", isPublished = true),
                craft(id = "craft-hidden", title = "Скрытый товар", isPublished = false),
            ),
        )

        assertEquals(
            listOf("Брелок ручной работы", "Зарядное устройство", "Чехол"),
            catalog.map(ShopCatalogEntry::title),
        )
        assertEquals(
            listOf("Craft", "Product", "Product"),
            catalog.map { it::class.simpleName },
        )
    }

    @Test
    fun `legacy crafts destination resolves to the unified catalog`() {
        assertEquals(CustomerShopTab.CATALOG, resolveCustomerShopTab("CRAFTS"))
        assertEquals(CustomerShopTab.CATALOG, resolveCustomerShopTab("PRODUCTS"))
        assertEquals(CustomerShopTab.CART, resolveCustomerShopTab("CART"))
    }

    private fun craft(id: String, title: String, isPublished: Boolean) = CraftItem(
        id = id,
        title = title,
        description = "Описание",
        priceRub = 300,
        stockQuantity = 1,
        imageObjectId = null,
        isPublished = isPublished,
        customOrderAvailable = false,
    )
}
