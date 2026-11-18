package ru.utp.servise.data

import org.junit.Assert.assertEquals
import org.junit.Test

class RepairWorkActCatalogShortcutsTest {
    private val items = listOf(
        CatalogItem(
            id = "service-clean",
            type = "SERVICE",
            name = "Чистка ноутбука",
            unitPriceRub = 1200,
            active = true,
            description = "Чистка системы охлаждения",
            deviceTypes = listOf("LAPTOP"),
        ),
        CatalogItem(
            id = "software-windows",
            type = "SERVICE",
            name = "Установка Windows 11",
            unitPriceRub = 2500,
            active = true,
            deviceTypes = listOf("COMPUTER", "LAPTOP", "MONOBLOCK"),
            serviceCategory = "SOFTWARE",
        ),
        CatalogItem(
            id = "part-fan",
            type = "SPARE_PART",
            name = "Вентилятор",
            unitPriceRub = 1800,
            active = true,
            stockQuantity = 4,
            deviceTypes = listOf("LAPTOP"),
        ),
        CatalogItem(
            id = "product-bag",
            type = "PRODUCT",
            name = "Сумка",
            unitPriceRub = 900,
            active = true,
        ),
    )

    @Test
    fun `favorite toggle adds and removes catalog item`() {
        assertEquals(
            listOf("service-clean", "part-fan"),
            toggleRepairCatalogFavorite(listOf("part-fan"), "service-clean"),
        )
        assertEquals(emptyList<String>(), toggleRepairCatalogFavorite(listOf("part-fan"), "part-fan"))
    }

    @Test
    fun `recently added catalog item moves to front and list is capped`() {
        val recent = (1..8).map { "item-$it" }

        assertEquals(
            listOf("item-9", "item-1", "item-2", "item-3", "item-4", "item-5", "item-6", "item-7"),
            recordRecentRepairCatalogItem(recent, "item-9"),
        )
        assertEquals(
            listOf("item-3", "item-1", "item-2"),
            recordRecentRepairCatalogItem(listOf("item-1", "item-2", "item-3"), "item-3"),
        )
    }

    @Test
    fun `catalog search filters by category and description in the selected shortcut list`() {
        val shortcuts = RepairWorkActCatalogShortcuts(
            favoriteIds = listOf("service-clean", "part-fan"),
            recentIds = listOf("part-fan", "service-clean"),
        )

        assertEquals(
            listOf("service-clean"),
            filterRepairWorkActCatalogItems(items, "FAVORITES", "SERVICE", "охлаждения", shortcuts).map { it.id },
        )
        assertEquals(
            listOf("part-fan", "service-clean"),
            filterRepairWorkActCatalogItems(items, "RECENT", "ALL", "", shortcuts).map { it.id },
        )
        assertEquals(
            listOf("software-windows"),
            filterRepairWorkActCatalogItems(items, "ALL", "SOFTWARE", "", shortcuts).map { it.id },
        )
    }
}
