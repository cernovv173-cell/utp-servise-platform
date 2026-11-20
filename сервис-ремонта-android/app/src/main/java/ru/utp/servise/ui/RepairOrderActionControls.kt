package ru.utp.servise.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.RepairReviewRequestResult

@Composable
internal fun RepairOrderActionControls(
    order: RepairOrder,
    role: String,
    token: String,
    currentUserId: String,
    runAction: RunAction,
    onEdit: () -> Unit,
    onAssign: () -> Unit,
    onAddItem: () -> Unit,
    onChat: (String) -> Unit,
    onReview: (String) -> Unit,
) {
    var reviewRequestResult by remember(order.id) {
        mutableStateOf<RepairReviewRequestResult?>(null)
    }
    val diagnosisOnlyReturn =
        order.visitScenarioVersion > 0 &&
            order.diagnosisCompletedAt != null &&
            order.estimates.lastOrNull()?.status == "DECLINED" &&
            order.items.isEmpty()
    val actions = buildList {
        when (role) {
            "CUSTOMER" -> if (order.status == "REQUESTED") add("Отменить заявку" to "CANCELLED")
            "TECHNICIAN" -> when (order.status) {
                "ASSIGNED" -> add("Начать ремонт" to "IN_PROGRESS")
                "IN_PROGRESS" -> if (order.visitScenarioVersion < 1) add("Готов к выдаче" to "READY_FOR_PICKUP")
            }
            "ADMIN" -> when (order.status) {
                "ASSIGNED" -> add("Начать ремонт" to "IN_PROGRESS")
                "IN_PROGRESS" -> {
                    if (order.visitScenarioVersion < 1 ||
                        (order.repairLocation == "SERVICE_CENTER" &&
                            (order.technicianRepairCompletedAt != null || diagnosisOnlyReturn))
                    ) {
                        add("Готова к выдаче" to "READY_FOR_PICKUP")
                    }
                    add("Отменить" to "CANCELLED")
                }
                "REQUESTED" -> add("Отменить" to "CANCELLED")
            }
        }
    }

    val canEdit =
        (order.status == "REQUESTED" && role in listOf("CUSTOMER", "ADMIN")) ||
            (role == "ADMIN" && order.status in listOf(
                "ASSIGNED",
                "IN_PROGRESS",
                "READY_FOR_PICKUP",
                "COMPLETED",
            ))
    if (canEdit) {
        ActionButton("Редактировать заказ", onEdit)
    }
    if (role == "ADMIN" && order.status in listOf("REQUESTED", "ASSIGNED")) {
        ActionButton(if (order.technicianName.isBlank()) "Назначить мастера" else "Сменить мастера", onAssign)
    }
    if (
        role in listOf("ADMIN", "TECHNICIAN") &&
        !order.workActRequired &&
        order.workAct == null &&
        order.estimates.isEmpty() &&
        order.status in listOf("REQUESTED", "ASSIGNED", "IN_PROGRESS", "READY_FOR_PICKUP")
    ) {
        ActionButton("Добавить услугу или запчасть", onAddItem)
    }
    if (
        role in listOf("ADMIN", "TECHNICIAN") &&
        order.visitScenarioVersion < 1 &&
        order.status in listOf("ASSIGNED", "IN_PROGRESS") &&
        order.diagnosisCompletedAt == null
    ) {
        ActionButton("Диагностика завершена", onClick = {
            runAction({ ApiClient.completeRepairDiagnosis(token, order.id) }, {})
        })
    }
    if (role == "CUSTOMER" || role == "TECHNICIAN") {
        ActionButton("Открыть чат по заказу", onClick = { onChat(order.id) })
    }
    actions.forEach { (label, status) ->
        val estimateBlocksAction = when (status) {
            "IN_PROGRESS" -> {
                val onsiteVisit = order.visitScenarioVersion > 0 &&
                    order.repairLocation == "CUSTOMER_ADDRESS" &&
                    order.visitPickupAgreedAt == null
                !onsiteVisit && order.estimates.lastOrNull()?.status != "APPROVED"
            }
            "READY_FOR_PICKUP" -> order.estimates.lastOrNull()?.status == "PENDING"
            else -> false
        }
        val workActBlocksAction = status == "READY_FOR_PICKUP" &&
            !diagnosisOnlyReturn &&
            (order.workActRequired || order.workAct != null) &&
            order.workAct?.status != "APPROVED"
        ActionButton(
            label = when {
                workActBlocksAction -> "Ожидает подтверждения акта администратором"
                estimateBlocksAction -> "Ожидает подтверждения администратора"
                else -> label
            },
            enabled = !estimateBlocksAction && !workActBlocksAction,
            onClick = {
                runAction({ ApiClient.updateStatus(token, order.id, status) }, {})
            },
        )
    }
    if (role == "CUSTOMER" && order.status == "COMPLETED") {
        RepairCompletionCard(order = order, onReview = onReview)
    }
    if (
        role == "TECHNICIAN" &&
        currentUserId == order.technicianId &&
        order.status == "COMPLETED" &&
        !order.hasReview
    ) {
        val requestAlreadySent = order.reviewRequestedAt != null || reviewRequestResult != null
        ActionButton(
            label = if (requestAlreadySent) "Запрос уже отправлен" else "Запросить отзыв",
            enabled = !requestAlreadySent,
            onClick = {
                runAction({ ApiClient.requestRepairReview(token, order.id) }) { result ->
                    reviewRequestResult = result as? RepairReviewRequestResult
                }
            },
        )
        if (reviewRequestResult?.notificationSent == false) {
            Text(
                "Push не доставлен; просьба сохранена в заказе клиента.",
                modifier = Modifier.padding(top = 6.dp),
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun ActionButton(
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(label)
    }
}
