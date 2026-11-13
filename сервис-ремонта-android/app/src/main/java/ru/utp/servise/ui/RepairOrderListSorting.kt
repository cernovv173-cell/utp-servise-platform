package ru.utp.servise.ui

import ru.utp.servise.data.RepairOrder

internal fun prioritizeRepairOrders(orders: List<RepairOrder>, role: String): List<RepairOrder> =
    orders.sortedWith(
        compareBy<RepairOrder> { attentionRank(it, role) }
            .thenBy { if (it.priority == "URGENT") 0 else 1 }
            .thenBy { it.expectedCompletionAt ?: "9999" }
            .thenByDescending { it.createdAt },
    )

private fun attentionRank(order: RepairOrder, role: String): Int = when (role) {
    "CUSTOMER" -> when (order.status) {
        "READY_FOR_PICKUP" -> 0
        "IN_PROGRESS" -> 1
        "ASSIGNED" -> 2
        "REQUESTED" -> 3
        else -> 4
    }

    "TECHNICIAN" -> when (order.status) {
        "ASSIGNED" -> 0
        "IN_PROGRESS" -> 1
        "READY_FOR_PICKUP" -> 2
        else -> 3
    }

    "ADMIN" -> when {
        order.status == "REQUESTED" -> 0
        order.estimates.lastOrNull()?.status == "PENDING" -> 1
        order.workAct?.status == "PENDING" -> 1
        order.status == "READY_FOR_PICKUP" -> 2
        order.status == "ASSIGNED" -> 3
        order.status == "IN_PROGRESS" -> 4
        else -> 5
    }

    else -> 0
}
