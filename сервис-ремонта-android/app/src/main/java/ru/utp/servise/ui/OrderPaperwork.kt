package ru.utp.servise.ui

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.statusLabel

@Composable
internal fun OrderPaperworkDialog(
    order: RepairOrder,
    role: String,
    currentUserId: String,
    token: String,
    runAction: RunAction,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val intake = order.intake
    val includeIntakeAct =
        !(order.visitScenarioVersion > 0 && order.repairLocation == "CUSTOMER_ADDRESS")
    val canEdit =
        (role == "ADMIN" && order.status == "REQUESTED") ||
            (role == "TECHNICIAN" &&
                order.technicianId == currentUserId &&
                order.status in listOf("ASSIGNED", "IN_PROGRESS"))
    val legacySummary = listOf(
        "Передняя сторона" to intake?.frontCondition,
        "Задняя сторона" to intake?.backCondition,
        "Левая сторона" to intake?.leftCondition,
        "Правая сторона" to intake?.rightCondition,
    ).mapNotNull { (label, value) -> value?.takeIf(String::isNotBlank)?.let { "$label: $it" } }
        .joinToString("\n")
    var conditionSummary by remember(order.id) {
        mutableStateOf(intake?.conditionSummary?.takeIf(String::isNotBlank) ?: legacySummary)
    }
    var serial by remember(order.id) { mutableStateOf(intake?.serialNumber.orEmpty()) }
    var accessories by remember(order.id) { mutableStateOf(intake?.includedAccessories.orEmpty()) }
    var notes by remember(order.id) { mutableStateOf(intake?.intakeNotes.orEmpty()) }
    val pdfLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/pdf"),
    ) { uri ->
        if (uri != null) {
            runAction({
                val pdfSections = buildList {
                    if (includeIntakeAct) {
                        add(
                            OrderPaperworkPdfSection(
                                "Акт приёма устройства",
                                listOf(
                                    "Клиент: ${order.customerName}",
                                    "Устройство: ${order.deviceType}",
                                    "Дата приёма: ${order.createdAt.take(10)}",
                                    "Серийный номер: ${serial.ifBlank { "—" }}",
                                    "Заявленная неисправность: ${order.problem}",
                                    "Состояние устройства: ${conditionSummary.ifBlank { "Не указано" }}",
                                    "Комплектность: ${accessories.ifBlank { "—" }}",
                                    "Примечания: ${notes.ifBlank { "—" }}",
                                    "Подпись клиента: ____________________    Представитель сервиса: ____________________",
                                ),
                            ),
                        )
                    }
                    add(
                        OrderPaperworkPdfSection(
                            "Заказ-наряд",
                            listOf(
                                "Клиент: ${order.customerName}",
                                "Устройство: ${order.deviceType} · ${order.status.statusLabel()}",
                                "Дата заявки: ${order.createdAt.take(10)}",
                                "Неисправность: ${order.problem}",
                                "Адрес: ${order.address.ifBlank { "—" }}",
                            ) + order.items.map { item ->
                                "${item.name} · ${item.quantity} шт. × ${item.unitPriceRub} ₽ = " +
                                    "${item.quantity.toLong() * item.unitPriceRub} ₽"
                            } + "Подпись клиента: ____________________    Представитель сервиса: ____________________",
                        ),
                    )
                    val warranty = order.warranty
                    if (warranty != null) {
                        add(
                            OrderPaperworkPdfSection(
                                "Гарантийный талон ${warranty.warrantyNumber}",
                                listOf(
                                    "Клиент: ${warranty.customerName}",
                                    "Устройство: ${warranty.deviceType}",
                                    "Выполненные работы: ${warranty.repairSummary}",
                                    "Срок гарантии: ${warranty.warrantyDays.warrantyDaysLabel()}",
                                    "Выдан: ${warranty.issuedAt.take(10)}",
                                    "Действует до: ${warranty.expiresAt.take(10)}",
                                    "Условия гарантии:",
                                    warranty.terms,
                                ),
                            ),
                        )
                    } else {
                        add(
                            OrderPaperworkPdfSection(
                                "Гарантийный талон",
                                listOf("Будет сформирован после закрытия и выдачи заказа."),
                            ),
                        )
                    }
                }
                saveOrderPaperworkPdf(context, uri, order.serviceNumber, pdfSections)
                true
            }) { Toast.makeText(context, "PDF сохранён.", Toast.LENGTH_SHORT).show() }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Документы · ${order.serviceNumber}") },
        text = {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                OutlinedButton(
                    onClick = { pdfLauncher.launch("Документы_${order.serviceNumber}.pdf") },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        if (includeIntakeAct) "Сохранить акт приёма, заказ-наряд и гарантийный талон в PDF"
                        else "Сохранить заказ-наряд и гарантийный талон в PDF",
                    )
                }
                if (order.warranty == null) {
                    Text(
                        "Гарантийный талон будет включён после закрытия заказа.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                }
                if (includeIntakeAct) {
                    Text("Акт приёма-передачи", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue)
                    if (canEdit) {
                        OutlinedTextField(
                            value = conditionSummary,
                            onValueChange = { conditionSummary = it.take(2000) },
                            label = { Text("Состояние и видимые повреждения") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 3,
                            maxLines = 6,
                            shape = RoundedCornerShape(12.dp),
                        )
                    } else {
                        Text(conditionSummary.ifBlank { "Состояние не указано" }, fontSize = 13.sp, color = UtpMuted)
                    }
                    if (canEdit) {
                        OutlinedTextField(
                            serial,
                            { serial = it },
                            label = { Text("Серийный номер") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                        )
                        OutlinedTextField(
                            accessories,
                            { accessories = it },
                            label = { Text("Комплектность / аксессуары") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            shape = RoundedCornerShape(12.dp),
                        )
                        OutlinedTextField(
                            notes,
                            { notes = it },
                            label = { Text("Примечания") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            shape = RoundedCornerShape(12.dp),
                        )
                        Button(
                            onClick = {
                                runAction({
                                    ApiClient.saveOrderIntake(
                                        token,
                                        order.id,
                                        conditionSummary,
                                        serial,
                                        accessories,
                                        notes,
                                    )
                                }) { onDismiss() }
                            },
                            enabled = conditionSummary.trim().length >= 2,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Сохранить акт") }
                    } else {
                        Text("Серийный номер: ${intake?.serialNumber ?: "—"}", color = UtpMuted)
                        Text(
                            "Комплектность: ${intake?.includedAccessories?.ifBlank { "—" } ?: "—"}",
                            color = UtpMuted,
                        )
                        Text("Примечания: ${intake?.intakeNotes?.ifBlank { "—" } ?: "—"}", color = UtpMuted)
                    }
                }

                Spacer(Modifier.height(4.dp))
                Text("Заказ-наряд", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue)
                Text("${order.deviceType} · ${order.status.statusLabel()}", color = UtpInk)
                Text("Описание: ${order.problem}", color = UtpMuted)
                order.items.forEach { item ->
                    Text(
                        "• ${item.name} × ${item.quantity} · ${item.quantity.toLong() * item.unitPriceRub} ₽",
                        color = UtpMuted,
                        fontSize = 12.sp,
                    )
                }
                Text("Клиент: ${order.customerName}", color = UtpMuted, fontSize = 12.sp)

                order.warranty?.let { warranty ->
                    Text(
                        "Гарантийный талон · ${warranty.warrantyNumber}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpBlue,
                    )
                    Text("Клиент: ${warranty.customerName} · ${warranty.deviceType}", color = UtpInk)
                    Text("Работы: ${warranty.repairSummary}", color = UtpMuted)
                    Text(
                        "Срок: ${warranty.warrantyDays.warrantyDaysLabel()} · до ${warranty.expiresAt.take(10)}",
                        color = UtpMuted,
                    )
                    Text("Выдан: ${warranty.issuedAt.take(10)}", color = UtpMuted)
                    Text("Условия: ${warranty.terms}", color = UtpMuted)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Закрыть") } },
    )
}

private fun Int.warrantyDaysLabel(): String =
    if (this == 365 || this == 366) "1 год" else "$this дней"
