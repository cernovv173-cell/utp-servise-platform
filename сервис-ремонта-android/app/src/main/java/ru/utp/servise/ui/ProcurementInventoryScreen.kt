package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem

@Composable
fun ProcurementInventoryScreen(
    catalogItems: List<CatalogItem>,
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onRefresh: () -> Unit,
    onError: (String) -> Unit,
) {
    val inventory = catalogItems.filter {
        it.active && (it.type == "SPARE_PART" || it.type == "PRODUCT")
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale).padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Column(Modifier.padding(top = 18.dp, bottom = 4.dp)) {
                Text("Товары и запчасти", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text(
                    "Просматривайте склад и изменяйте только количество и минимальный запас.",
                    modifier = Modifier.padding(top = 5.dp),
                    fontSize = 13.sp,
                    color = UtpMuted,
                )
            }
        }
        if (inventory.isEmpty()) {
            item {
                Text(
                    "Активных товаров и запчастей пока нет.",
                    modifier = Modifier.padding(vertical = 14.dp),
                    color = UtpMuted,
                )
            }
        } else {
            items(inventory, key = { it.id }) { item ->
                InventoryItemCard(item, token, busy, runAction, onRefresh, onError)
            }
        }
    }
}

@Composable
private fun InventoryItemCard(
    item: CatalogItem,
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onRefresh: () -> Unit,
    onError: (String) -> Unit,
) {
    var stock by remember(item.id, item.stockQuantity) {
        mutableStateOf((item.stockQuantity ?: 0).toString())
    }
    var minimum by remember(item.id, item.minimumStockQuantity) {
        mutableStateOf((item.minimumStockQuantity ?: 0).toString())
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                if (item.type == "SPARE_PART") "Запчасть" else "Товар",
                fontSize = 11.sp,
                color = UtpMuted,
            )
            Text(item.name, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = stock,
                    onValueChange = { value -> if (value.all(Char::isDigit)) stock = value },
                    label = { Text("Остаток") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = minimum,
                    onValueChange = { value -> if (value.all(Char::isDigit)) minimum = value },
                    label = { Text("Минимум") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(12.dp),
                )
            }
            Button(
                onClick = {
                    val stockValue = stock.toIntOrNull()
                    val minimumValue = minimum.toIntOrNull()
                    if (stockValue == null || minimumValue == null) {
                        onError("Укажите целое неотрицательное число для обоих остатков.")
                    } else {
                        runAction(
                            {
                                ApiClient.updateCatalogInventory(
                                    token,
                                    item.id,
                                    stockValue,
                                    minimumValue,
                                )
                            },
                            { onRefresh() },
                        )
                    }
                },
                enabled = !busy && stock.isNotBlank() && minimum.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(if (busy) "Сохраняем…" else "Сохранить остатки")
            }
        }
    }
}
