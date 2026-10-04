package ru.utp.servise.ui

import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.PickupCode
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.statusLabel

private data class DeviceSide(
    val key: String,
    val title: String,
    val note: String,
    val photo: String?,
)

@Composable
internal fun OrderPaperworkDialog(
    order: RepairOrder,
    role: String,
    token: String,
    runAction: RunAction,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val intake = order.intake
    val canEdit = role in listOf("ADMIN", "TECHNICIAN") &&
        order.status !in listOf("READY_FOR_PICKUP", "COMPLETED", "CANCELLED")
    var front by remember(order.id) { mutableStateOf(intake?.frontCondition.orEmpty()) }
    var back by remember(order.id) { mutableStateOf(intake?.backCondition.orEmpty()) }
    var left by remember(order.id) { mutableStateOf(intake?.leftCondition.orEmpty()) }
    var right by remember(order.id) { mutableStateOf(intake?.rightCondition.orEmpty()) }
    var serial by remember(order.id) { mutableStateOf(intake?.serialNumber.orEmpty()) }
    var accessories by remember(order.id) { mutableStateOf(intake?.includedAccessories.orEmpty()) }
    var notes by remember(order.id) { mutableStateOf(intake?.intakeNotes.orEmpty()) }
    var pickupCode by remember(order.id) { mutableStateOf<PickupCode?>(null) }
    val uploaded = remember(order.id) { mutableStateMapOf<String, Boolean>() }
    val sides = listOf(
        DeviceSide("front", "Передняя сторона", front, intake?.frontPhotoObjectId),
        DeviceSide("back", "Задняя сторона", back, intake?.backPhotoObjectId),
        DeviceSide("left", "Левая сторона", left, intake?.leftPhotoObjectId),
        DeviceSide("right", "Правая сторона", right, intake?.rightPhotoObjectId),
    )
    val hasAllPhotos = sides.all { it.photo != null || uploaded[it.key] == true }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Документы · ${order.serviceNumber}") },
        text = {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Text("Акт приёма устройства", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue)
                sides.forEach { side ->
                    Text(side.title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    if (canEdit) {
                        OutlinedTextField(
                            value = when (side.key) {
                                "front" -> front
                                "back" -> back
                                "left" -> left
                                else -> right
                            },
                            onValueChange = { value ->
                                when (side.key) {
                                    "front" -> front = value
                                    "back" -> back = value
                                    "left" -> left = value
                                    else -> right = value
                                }
                            },
                            label = { Text("Видимые повреждения / состояние") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            shape = RoundedCornerShape(12.dp),
                        )
                        side.photo?.let {
                            RemoteProjectImage(
                                it,
                                token,
                                Modifier.fillMaxWidth().height(125.dp),
                                "${side.title}: фото",
                            )
                        }
                        PhotoPickerButton(
                            if (uploaded[side.key] == true) "Фото загружено · заменить" else "Добавить фото",
                        ) { uri: Uri ->
                            runAction({
                                ApiClient.uploadIntakePhoto(
                                    token,
                                    order.id,
                                    side.key,
                                    compressSelectedImage(context, uri),
                                )
                            }) {
                                uploaded[side.key] = true
                            }
                        }
                    } else {
                        Text(side.note.ifBlank { "Состояние не указано" }, fontSize = 13.sp, color = UtpMuted)
                        side.photo?.let {
                            RemoteProjectImage(
                                it,
                                token,
                                Modifier.fillMaxWidth().height(125.dp),
                                "${side.title}: фото",
                            )
                        }
                    }
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
                                    front,
                                    back,
                                    left,
                                    right,
                                    serial,
                                    accessories,
                                    notes,
                                )
                            }) { onDismiss() }
                        },
                        enabled = hasAllPhotos &&
                            listOf(front, back, left, right).all { it.trim().length >= 2 },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Сохранить акт") }
                    if (!hasAllPhotos) {
                        Text(
                            "Загрузите фотографии всех четырёх сторон.",
                            color = UtpMuted,
                            fontSize = 12.sp,
                        )
                    }
                } else {
                    Text("Серийный номер: ${intake?.serialNumber ?: "—"}", color = UtpMuted)
                    Text(
                        "Комплектность: ${intake?.includedAccessories?.ifBlank { "—" } ?: "—"}",
                        color = UtpMuted,
                    )
                    Text("Примечания: ${intake?.intakeNotes?.ifBlank { "—" } ?: "—"}", color = UtpMuted)
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
                if (role == "CUSTOMER" && order.status == "READY_FOR_PICKUP") {
                    Button(
                        onClick = {
                            runAction({ ApiClient.createPickupCode(token, order.id) }) {
                                pickupCode = it as? PickupCode
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (pickupCode == null) "Показать QR для выдачи" else "Обновить QR выдачи") }
                    pickupCode?.let { code ->
                        QrPayloadImage(code.qrPayload)
                        Text(
                            "Если QR не сканируется, сообщите сотруднику код:",
                            color = UtpMuted,
                            fontSize = 12.sp,
                        )
                        Text(
                            code.fallbackPin,
                            color = UtpBlue,
                            fontSize = 30.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 8.sp,
                        )
                        Text(
                            "Покажите код сотруднику для получения заказа. " +
                                "Код действует до ${code.expiresAt.take(16).replace('T', ' ')}; " +
                                "новый код отменит предыдущий.",
                            color = UtpMuted,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Закрыть") } },
    )
}

@Composable
internal fun PickupQrScannerDialog(
    serviceNumber: String,
    token: String,
    runAction: RunAction,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    var payload by remember { mutableStateOf("") }
    var pickupPin by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Выдача заказа") },
        text = {
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Постоянные условия гарантии: 1 год. После выдачи талон с датами, перечнем " +
                        "работ и полным текстом условий сохранится в документах заявки.",
                    color = UtpMuted,
                )
                OutlinedButton(onClick = {
                    GmsBarcodeScanning.getClient(context).startScan()
                        .addOnSuccessListener { barcode ->
                            barcode.rawValue?.let {
                                payload = it
                                pickupPin = ""
                            }
                        }
                }, modifier = Modifier.fillMaxWidth()) {
                    Text("Сканировать QR клиента")
                }
                OutlinedTextField(
                    payload,
                    {
                        payload = it
                        pickupPin = ""
                    },
                    label = { Text("QR-код · можно ввести вручную") },
                    minLines = 2,
                )
                Text(
                    "Если QR не сканируется, попросите у клиента 4-значный код и введите его здесь.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
                OutlinedTextField(
                    pickupPin,
                    {
                        pickupPin = it.filter(Char::isDigit).take(4)
                        payload = ""
                    },
                    label = { Text("Резервный код · 4 цифры") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    singleLine = true,
                )
                Text(
                    "Код одноразовый. После подтверждения заявка закроется " +
                        "и будет создан гарантийный талон.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = payload.isNotBlank() || pickupPin.length == 4,
                onClick = {
                    runAction({
                        if (payload.isNotBlank()) {
                            ApiClient.closeOrderByQr(token, payload.trim())
                        } else {
                            ApiClient.closeOrderByPickupPin(
                                token,
                                serviceNumber,
                                pickupPin,
                            )
                        }
                    }) { onDismiss() }
                },
            ) { Text("Подтвердить выдачу") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

private fun Int.warrantyDaysLabel(): String =
    if (this == 365 || this == 366) "1 год" else "$this дней"

@Composable
private fun QrPayloadImage(payload: String) {
    val bitmap by produceState<Bitmap?>(null, payload) {
        value = runCatching {
            val size = 420
            val matrix = MultiFormatWriter().encode(payload, BarcodeFormat.QR_CODE, size, size)
            Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
                for (x in 0 until size) for (y in 0 until size) {
                    setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                }
            }
        }.getOrNull()
    }
    bitmap?.let {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Image(it.asImageBitmap(), contentDescription = "QR-код для выдачи заказа", modifier = Modifier.size(210.dp))
        }
    }
}
