package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.orderItemTypeLabel

@Composable
internal fun CatalogManagementItemCard(
    item: CatalogItem,
    token: String,
    runAction: RunAction,
    refresh: () -> Unit,
    onEdit: (CatalogItem) -> Unit,
    onToggleActive: (CatalogItem) -> Unit,
    onDelete: (CatalogItem) -> Unit,
) {
    val context = LocalContext.current
    val stockQuantity = item.stockQuantity
    val minimumStockQuantity = item.minimumStockQuantity
    val isTrackedActiveItem = item.active && item.type != "SERVICE" && stockQuantity != null

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(
                "${item.type.orderItemTypeLabel()}${if (item.serviceCategory == "SOFTWARE") " · ПО" else ""} · ${item.name}",
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
            )
            if (item.type == "SERVICE" || item.type == "SPARE_PART") {
                Text(
                    "Подходит для: ${item.deviceTypes.filter { it in repairDeviceTypes }.joinToString { it.deviceLabel() }}",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
            }
            Text(
                "${item.unitPriceRub} ₽ · ${if (item.active) "Активна" else "Скрыта из выбора"}" +
                    if (item.type != "SERVICE") {
                        " · ${item.stockQuantity?.let { "$it шт. в наличии" } ?: "остаток не задан"}" +
                            if (item.stockQuantity != null) {
                                " · порог ${minimumStockQuantity ?: DEFAULT_MINIMUM_STOCK_QUANTITY} шт."
                            } else ""
                    } else "",
                fontSize = 12.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 3.dp),
            )
            if (isTrackedActiveItem && isRestockNeeded(stockQuantity, minimumStockQuantity)) {
                Text(
                    if (stockQuantity == 0) "Закончилась — пополните запас"
                    else "Мало на складе — осталось $stockQuantity шт.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (stockQuantity == 0) {
                        androidx.compose.material3.MaterialTheme.colorScheme.error
                    } else {
                        UtpAmber
                    },
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
            if (item.type == "PRODUCT") {
                item.description?.takeIf { it.isNotBlank() }?.let {
                    Text(it, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 6.dp))
                }
                if (item.imageObjectIds.isNotEmpty()) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        item.imageObjectIds.take(4).forEachIndexed { index, objectId ->
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                RemoteProjectImage(
                                    objectId = objectId,
                                    token = token,
                                    modifier = Modifier.size(72.dp),
                                    contentDescription = "Фото ${index + 1}: ${item.name}",
                                )
                                TextButton(
                                    onClick = {
                                        runAction({ ApiClient.deleteCatalogProductImage(token, item.id, objectId) }) {
                                            refresh()
                                        }
                                    },
                                ) { Text("Удалить", fontSize = 10.sp) }
                            }
                        }
                    }
                }
                if (item.imageObjectIds.size < 3) {
                    PhotoPickerButton(label = "Добавить фото · ${item.imageObjectIds.size}/3") { uri ->
                        runAction({
                            ApiClient.uploadCatalogProductImage(
                                token,
                                item.id,
                                compressSelectedImage(context, uri),
                            )
                        }) { refresh() }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { onEdit(item) }) { Text("Изменить") }
                TextButton(onClick = { onToggleActive(item) }) {
                    Text(if (item.active) "Отключить" else "Включить")
                }
                TextButton(onClick = { onDelete(item) }) {
                    Text("Удалить навсегда", color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
