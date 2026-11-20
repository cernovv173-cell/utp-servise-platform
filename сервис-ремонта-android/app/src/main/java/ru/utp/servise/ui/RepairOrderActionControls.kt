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
    val isAssignedTechnician =
        role == "TECHNICIAN" && currentUserId == order.technicianId
    val diagnosisOnlyReturn =
        order.visitScenarioVersion > 0 &&
            order.diagnosisCompletedAt != null &&
            order.estimates.lastOrNull()?.status == "DECLINED" &&
            order.items.isEmpty()
    val actions = buildList {
        when (role) {
            "CUSTOMER" -> if (order.status == "REQUESTED") add("Отменить заявку" to "CANCELLED")
            "TECHNICIAN" -> if (isAssignedTechnician) {
                when (order.status) {
                    "ASSIGNED" -> add("Начать ремонт" to "IN_PROGRESS")
                    "IN_PROGRESS" -> {
                        val activeOnsiteVisit =
                            order.visitScenarioVersion > 0 &&
                                order.repairLocation == "CUSTOMER_ADDRESS" &&
                                order.visitPickupAgreedAt == null
                        val serviceCenterVisit =
                            order.visitScenarioVersion > 0 &&
                                order.repairLocation == "SERVICE_CENTER"
                        if (
                            !activeOnsiteVisit &&
                            (!serviceCenterVisit ||
                                order.technicianRepairCompletedAt != null || diagnosisOnlyReturn)
                        ) {
                            add("Готов к выдаче" to "READY_FOR_PICKUP")
                        }
                    }
                }
            }
            "ADMIN" -> if (order.status == "REQUESTED") {
                add("Отменить" to "CANCELLED")
            }
        }
    }

    val canEdit =
        order.status == "REQUESTED" && role in listOf("CUSTOMER", "ADMIN")
    if (canEdit) {
        ActionButton("Редактировать заказ", onEdit)
    }
    val canAssignTechnician =
        role == "ADMIN" &&
            (order.status == "REQUESTED" ||
                (order.technicianId == null &&
                    order.status in listOf("ASSIGNED", "IN_PROGRESS", "READY_FOR_PICKUP")))
    if (canAssignTechnician) {
        ActionButton(
            if (order.status == "REQUESTED") "Принять и назначить мастера"
            else "Назначить замену снятому мастеру",
            onAssign,
        )
    }
    if (
        isAssignedTechnician &&
        !order.workActRequired &&
        order.workAct == null &&
        order.estimates.isEmpty() &&
        order.status in listOf("ASSIGNED", "IN_PROGRESS")
    ) {
        ActionButton("Добавить услугу или запчасть", onAddItem)
    }
    if (
        isAssignedTechnician &&
        order.visitScenarioVersion < 1 &&
        order.status in listOf("ASSIGNED", "IN_PROGRESS") &&
        order.diagnosisCompletedAt == null
    ) {
        ActionButton("Диагностика завершена", onClick = {
            runAction({ ApiClient.completeRepairDiagnosis(token, order.id) }, {})
        })
    }
    if (role == "CUSTOMER" || isAssignedTechnician) {
        ActionButton("Открыть чат по заказу", onClick = { onChat(order.id) })
    }
    actions.forEach { (label, status) ->
        val activeOnsiteVisit =
            order.visitScenarioVersion > 0 &&
                order.repairLocation == "CUSTOMER_ADDRESS" &&
                order.visitPickupAgreedAt == null
        val estimateRequiredForStart =
            status == "IN_PROGRESS" &&
                !activeOnsiteVisit &&
                order.estimates.lastOrNull()?.status != "APPROVED"
        val estimateBlocksAction = when (status) {
            "IN_PROGRESS" -> {
                estimateRequiredForStart
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
                workActBlocksAction -> "Сначала подтвердите акт после звонка клиенту"
                estimateBlocksAction -> "Сначала согласуйте смету по телефону"
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
