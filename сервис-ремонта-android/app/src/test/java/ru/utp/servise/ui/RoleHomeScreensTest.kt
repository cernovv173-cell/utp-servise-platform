package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.utp.servise.data.RepairOrder

class RoleHomeScreensTest {
    @Test
    fun `technician dashboard counts active jobs and prioritizes assigned work`() {
        val orders = listOf(
            order("in-progress", "IN_PROGRESS"),
            order("assigned", "ASSIGNED", priority = "URGENT"),
            order("ready", "READY_FOR_PICKUP"),
            order("completed", "COMPLETED"),
            order("archived", "ASSIGNED", archivedAt = "2026-11-02T00:00:00Z"),
        )

        val summary = technicianDashboardSummary(orders)

        assertEquals(3, summary.activeCount)
        assertEquals(1, summary.urgentCount)
        assertEquals("assigned", summary.nextOrder?.id)
    }

    @Test
    fun `administrator dashboard counts work requiring action without counting history`() {
        val orders = listOf(
            order("requested", "REQUESTED"),
            order("assigned-urgent", "ASSIGNED", priority = "URGENT"),
            order("in-progress", "IN_PROGRESS"),
            order("ready", "READY_FOR_PICKUP"),
            order("completed", "COMPLETED"),
            order("archived-request", "REQUESTED", archivedAt = "2026-11-02T00:00:00Z"),
        )

        val summary = administratorDashboardSummary(orders)

        assertEquals(1, summary.actionRequiredCount)
        assertEquals(1, summary.newRequestCount)
        assertEquals(2, summary.activeRepairCount)
        assertEquals(1, summary.readyForPickupCount)
        assertEquals(1, summary.urgentCount)
        assertEquals("requested", summary.nextActionOrder?.id)
    }

    private fun order(
        id: String,
        status: String,
        priority: String = "NORMAL",
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
        priority = priority,
        archivedAt = archivedAt,
    )
}
