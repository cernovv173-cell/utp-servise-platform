package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.utp.servise.data.RepairOrder

class RepairOrderListSortingTest {
    @Test
    fun `customer sees ready for pickup before other active repairs`() {
        val orders = listOf(order("assigned", "ASSIGNED"), order("ready", "READY_FOR_PICKUP"))

        assertEquals(
            listOf("ready", "assigned"),
            prioritizeRepairOrders(orders, "CUSTOMER").map { it.id },
        )
    }

    @Test
    fun `technician sees newly assigned and urgent work first`() {
        val orders = listOf(
            order("in-progress", "IN_PROGRESS", priority = "URGENT"),
            order("assigned-normal", "ASSIGNED"),
            order("assigned-urgent", "ASSIGNED", priority = "URGENT"),
        )

        assertEquals(
            listOf("assigned-urgent", "assigned-normal", "in-progress"),
            prioritizeRepairOrders(orders, "TECHNICIAN").map { it.id },
        )
    }

    @Test
    fun `administrator sees new requests before routine work`() {
        val orders = listOf(
            order("in-progress", "IN_PROGRESS"),
            order("ready", "READY_FOR_PICKUP"),
            order("requested", "REQUESTED"),
        )

        assertEquals(
            listOf("requested", "ready", "in-progress"),
            prioritizeRepairOrders(orders, "ADMIN").map { it.id },
        )
    }

    private fun order(
        id: String,
        status: String,
        priority: String = "NORMAL",
        createdAt: String = "2026-11-01T10:00:00.000Z",
    ) = RepairOrder(
        id = id,
        deviceType = "LAPTOP",
        problem = "Не включается",
        address = "Пушкино",
        status = status,
        createdAt = createdAt,
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
        priority = priority,
    )
}
