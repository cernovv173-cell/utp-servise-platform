package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.ShopOrder

private fun shopOrderStatusLabel(status: String): String = when (status) {
    "PENDING" -> "Ожидает проверки"
    "CONFIRMED" -> "Наличие подтверждено"
    "COMPLETED" -> "Выдан"
    "CANCELLED" -> "Отменён"
    else -> status
}

@Composable
fun AdminShopOrdersScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    craftItems: List<CraftItem> = emptyList(),
    craftOrders: List<CraftOrder> = emptyList(),
    staff: List<StaffMember> = emptyList(),
    banners: List<SiteBanner> = emptyList(),
    onCampaignNavigate: (String) -> Unit = {},
    initialSection: String = "ORDERS",
) {
    val scope = rememberCoroutineScope()
    var orders by remember { mutableStateOf<List<ShopOrder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var showAllOrders by remember { mutableStateOf(false) }
    var selectedSection by remember { mutableStateOf(initialSection) }

    suspend fun reloadOrders() {
        isLoading = true
        loadError = null
        try {
            orders = withContext(Dispatchers.IO) { ApiClient.adminShopOrders(token) }
        } catch (failure: Exception) {
            loadError = failure.message ?: "Не удалось загрузить заказы магазина."
        } finally {
            isLoading = false
        }
    }

    fun changeStatus(order: ShopOrder, status: String) {
        runAction({ ApiClient.updateShopOrderStatus(token, order.id, status) }) { result ->
            (result as? ShopOrder)?.let { updated ->
                orders = orders.map { if (it.id == updated.id) updated else it }
                onRefresh()
                scope.launch { reloadOrders() }
            }
        }
    }

    fun offerDelivery(order: ShopOrder, feeRub: Int, window: String) {
        runAction({ ApiClient.offerShopDelivery(token, order.id, feeRub, window) }) { result ->
            (result as? ShopOrder)?.let { updated ->
                orders = orders.map { if (it.id == updated.id) updated else it }
                onRefresh()
                scope.launch { reloadOrders() }
            }
        }
    }

    LaunchedEffect(token) { reloadOrders() }

    val pendingCount = orders.count { it.status == "PENDING" }
    val visibleOrders = if (showAllOrders) orders else orders.filter { it.status == "PENDING" }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление") }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Магазин и рукоделие", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Заказы товаров и изделия ручной работы — в одном месте.", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = { scope.launch { reloadOrders() } }, enabled = !isLoading) { Text("Обновить") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (selectedSection == "ORDERS") {
                Button(onClick = { selectedSection = "ORDERS" }, modifier = Modifier.weight(1f)) { Text("Заказы магазина") }
            } else {
                OutlinedButton(onClick = { selectedSection = "ORDERS" }, modifier = Modifier.weight(1f)) { Text("Заказы магазина") }
            }
            if (selectedSection == "CRAFTS") {
                Button(onClick = { selectedSection = "CRAFTS" }, modifier = Modifier.weight(1f)) { Text("Рукоделие") }
            } else {
                OutlinedButton(onClick = { selectedSection = "CRAFTS" }, modifier = Modifier.weight(1f)) { Text("Рукоделие") }
            }
        }
        if (selectedSection == "ORDERS") {
        if (isLoading && orders.isEmpty()) Text("Загружаем заказы…", color = UtpMuted)
        if (orders.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (showAllOrders) {
                    OutlinedButton(onClick = { showAllOrders = false }) {
                        Text("На подтверждение · $pendingCount")
                    }
                } else {
                    Button(onClick = { showAllOrders = false }) {
                        Text("На подтверждение · $pendingCount")
                    }
                }
                if (showAllOrders) {
                    Button(onClick = { showAllOrders = true }) {
                        Text("Все заказы · ${orders.size}")
                    }
                } else {
                    OutlinedButton(onClick = { showAllOrders = true }) {
                        Text("Все заказы · ${orders.size}")
                    }
                }
            }
        }
        if (loadError != null && orders.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(15.dp)) {
                    Text(loadError.orEmpty(), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                    TextButton(onClick = { scope.launch { reloadOrders() } }) { Text("Повторить") }
                }
            }
        }
        if (!isLoading && loadError == null && orders.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text("Заказов из магазина пока нет.", Modifier.padding(15.dp), color = UtpMuted)
            }
        }
        if (!isLoading && loadError == null && orders.isNotEmpty() && visibleOrders.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text("Нет заказов, ожидающих подтверждения.", Modifier.padding(15.dp), color = UtpMuted)
            }
        }
        visibleOrders.forEach { order ->
            AdminShopOrderCard(
                order = order,
                busy = busy,
                onConfirm = { changeStatus(order, "CONFIRMED") },
                onComplete = { changeStatus(order, "COMPLETED") },
                onCancel = { changeStatus(order, "CANCELLED") },
                onOfferDelivery = { fee, window -> offerDelivery(order, fee, window) },
            )
        }
        } else {
            CraftsScreen(
                token = token,
                isAdmin = true,
                items = craftItems,
                orders = craftOrders,
                staff = staff,
                runAction = runAction,
                refresh = onRefresh,
                onBack = {},
                banners = banners,
                onCampaignNavigate = onCampaignNavigate,
                embedded = true,
            )
        }
    }
}

@Composable
private fun AdminShopOrderCard(
    order: ShopOrder,
    busy: Boolean,
    onConfirm: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
    onOfferDelivery: (Int, String) -> Unit,
) {
    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Заказ #${order.id.take(8)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(shopOrderStatusLabel(order.status), fontSize = 12.sp, color = UtpBlue)
            }
            Text(order.customer?.displayName ?: "Клиент", fontWeight = FontWeight.Medium, color = UtpInk)
            order.customer?.phoneNumber?.let { Text("Телефон: $it", fontSize = 12.sp, color = UtpMuted) }
            order.customer?.email?.let { Text(it, fontSize = 12.sp, color = UtpMuted) }
            if (order.deliveryMethod == "COURIER") {
                Text("Курьерская доставка · ${deliveryAreaLabel(order.deliveryArea)}", fontWeight = FontWeight.Medium, color = UtpInk)
                Text("${order.deliveryCity.orEmpty()}, ${order.deliveryAddress.orEmpty()}", fontSize = 12.sp, color = UtpMuted)
                order.deliveryRequestNote?.takeIf { it.isNotBlank() }?.let {
                    Text("Комментарий курьеру: $it", fontSize = 12.sp, color = UtpMuted)
                }
                order.deliveryOfferAcceptedAt?.let {
                    Text("Клиент согласился с ценой и сроком доставки.", fontSize = 12.sp, color = UtpBlue)
                }
                if (order.status == "PENDING") {
                    AdminShopDeliveryOfferEditor(order = order, busy = busy, onOffer = onOfferDelivery)
                }
            }
            Spacer(Modifier.height(2.dp))
            order.items.forEach { item ->
                Text("${item.name} × ${item.quantity} — ${shopPrice(item.quantity * item.unitPriceRub)}", fontSize = 12.sp, color = UtpMuted)
            }
            order.customerNote?.takeIf { it.isNotBlank() }?.let {
                Text("Комментарий: $it", fontSize = 12.sp, color = UtpMuted)
            }
            Text("Итого: ${shopPrice(order.totalRub)}", fontWeight = FontWeight.Bold, color = UtpInk)
            if (order.status == "PENDING" || order.status == "CONFIRMED") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    if (order.status == "PENDING") {
                        val canConfirm = order.deliveryMethod != "COURIER" || order.deliveryOfferAcceptedAt != null
                        Button(onClick = onConfirm, enabled = !busy && canConfirm, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                            Text("Подтвердить наличие")
                        }
                    } else {
                        Button(onClick = onComplete, enabled = !busy, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                            Text("Отметить выданным")
                        }
                    }
                    OutlinedButton(onClick = onCancel, enabled = !busy, shape = RoundedCornerShape(12.dp)) {
                        Text("Отменить")
                    }
                }
                if (order.status == "PENDING" && order.deliveryMethod == "COURIER" && order.deliveryOfferAcceptedAt == null) {
                    Text("Подтвердить заказ можно после согласия клиента с ценой и сроком доставки.", fontSize = 11.sp, color = UtpMuted)
                }
            }
        }
    }
}

private fun shopPrice(amount: Int): String =
    "${java.text.NumberFormat.getIntegerInstance(java.util.Locale("ru", "RU")).format(amount)} ₽"
