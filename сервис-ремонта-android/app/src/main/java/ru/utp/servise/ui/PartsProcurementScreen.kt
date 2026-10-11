package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.ProcurementItem

@Composable
fun PartsProcurementScreen(token: String, onError: (String) -> Unit) {
    var items by remember { mutableStateOf<List<ProcurementItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(token) {
        loading = true
        runCatching { withContext(Dispatchers.IO) { ApiClient.procurementList(token) } }
            .onSuccess { items = it }
            .onFailure { onError(it.message ?: "Не удалось загрузить закупочную сводку.") }
        loading = false
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Text("Закупка запчастей", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "Рекомендуемое количество рассчитано до минимального остатка.",
            fontSize = 13.sp,
            color = UtpMuted,
        )
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
        ) {
            Text(
                "Детали из согласованных смет уже списаны со склада и не прибавляются повторно к закупке.",
                Modifier.padding(14.dp),
                fontSize = 12.sp,
                lineHeight = 18.sp,
                color = UtpMuted,
            )
        }
        if (loading) Text("Загружаем список…", color = UtpMuted)
        if (!loading && items.isEmpty()) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Пополнение не требуется", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Складских запчастей достаточно для текущих порогов и ремонтов.", fontSize = 12.sp, color = UtpMuted)
                }
            }
        }
        items.forEach { item -> ProcurementCard(item) }
    }
}

@Composable
private fun ProcurementCard(item: ProcurementItem) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth()) {
                Text(item.name, Modifier.weight(1f), fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Заказать: ${item.recommendedPurchase}", fontWeight = FontWeight.Bold, color = UtpBlue)
            }
            Text("Остаток: ${item.stockQuantity} · минимум: ${item.minimumStockQuantity}", fontSize = 12.sp, color = UtpMuted)
            if (item.activeEstimateQuantity > 0) {
                Text(
                    "В текущих согласованных ремонтах: ${item.activeEstimateQuantity} шт. (уже списано)",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
            }
        }
    }
}
