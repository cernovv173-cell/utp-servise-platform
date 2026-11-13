package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.utp.servise.data.RepairOrder

class CustomerHomeScreenLogicTest {
    @Test
    fun `customer home shows only active non-archived repairs and prioritizes pickup`() {
        val orders = listOf(
            order("completed", "COMPLETED"),
            order("in-progress", "IN_PROGRESS"),
            order("pickup", "READY_FOR_PICKUP"),
            order("archived", "ASSIGNED", archivedAt = "2026-11-02T00:00:00Z"),
        )

        assertEquals(
            listOf("pickup", "in-progress"),
            customerHomeActiveOrders(orders).map { it.id },
        )
    }

    private fun order(
        id: String,
        status: String,
        archivedAt: String? = null,
    ) = RepairOrder(
        id = id,
        deviceType = "LAPTOP",
        problem = "Не включается",
        address = "Пушкино",
        status = status,
        createdAt = "2026-11-01T10:00:00.000Z",
        customerName = "Клиент",
        customerPhoneNumber = null,
        customerAvatarObjectId = null,
        technicianName = "Мастер",
        technicianPhoneNumber = null,
        technicianAvatarObjectId = null,
        hasReview = false,
        history = emptyList(),
        items = emptyList(),
        photos = emptyList(),
        archivedAt = archivedAt,
    )
}
