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
import androidx.compose.material3.OutlinedTextField
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
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.ShopOrder
import ru.utp.servise.data.ShopProduct
import ru.utp.servise.data.readShopCart
import ru.utp.servise.data.saveShopCart

private fun shopPrice(amount: Int): String =
    "${java.text.NumberFormat.getIntegerInstance(java.util.Locale("ru", "RU")).format(amount)} ₽"

private fun shopOrderStatus(status: String): String = when (status) {
    "PENDING" -> "Ожидает подтверждения"
    "CONFIRMED" -> "Наличие подтверждено"
    "COMPLETED" -> "Выдан"
    "CANCELLED" -> "Отменён"
    else -> status
}

private fun productAvailability(availability: String): String = when (availability) {
    "IN_STOCK" -> "Есть в наличии"
    "OUT_OF_STOCK" -> "Нет в наличии"
    else -> "Наличие уточнит администратор"
}

@Composable
fun CustomerShopScreen(
    user: AppUser,
    token: String,
    runAction: RunAction,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    var products by remember { mutableStateOf<List<ShopProduct>>(emptyList()) }
    var orders by remember { mutableStateOf<List<ShopOrder>>(emptyList()) }
    var cart by remember(user.id) { mutableStateOf(readShopCart(context, user.id)) }
    var customerNote by remember(user.id) { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        isLoading = true
        loadError = null
        try {
            val loaded = withContext(Dispatchers.IO) {
                ApiClient.shopProducts() to ApiClient.customerShopOrders(token)
            }
            products = loaded.first
            orders = loaded.second
            val validIds = loaded.first.map { it.id }.toSet()
            val cleanedCart = cart.filterKeys { it in validIds }
            cart = cleanedCart
            saveShopCart(context, user.id, cleanedCart)
        } catch (failure: Exception) {
            loadError = failure.message ?: "Не удалось загрузить магазин."
        } finally {
            isLoading = false
        }
    }

    LaunchedEffect(token, user.id) { reload() }

    fun setQuantity(productId: String, quantity: Int) {
        val nextCart = if (quantity < 1) {
            cart - productId
        } else {
            cart + (productId to quantity.coerceAtMost(100))
        }
        cart = nextCart
        saveShopCart(context, user.id, nextCart)
    }

    val cartItems = products.filter { cart[it.id] != null }
    val totalRub = cartItems.sumOf { product -> product.unitPriceRub * (cart[product.id] ?: 0) }
    val hasOutOfStock = cartItems.any { it.availability == "OUT_OF_STOCK" }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text("Магазин товаров", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Товары — отдельно от запчастей для ремонта", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = { scope.launch { reload() } }, enabled = !isLoading) { Text("Обновить") }
        }
        successMessage?.let { message ->
            Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.primaryContainer)) {
                Text(message, Modifier.fillMaxWidth().padding(13.dp), color = androidx.compose.material3.MaterialTheme.colorScheme.onPrimaryContainer, fontSize = 12.sp)
            }
        }

        if (isLoading && products.isEmpty()) {
            Text("Загружаем товары…", color = UtpMuted)
        } else if (loadError != null && products.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text(loadError.orEmpty(), Modifier.fillMaxWidth().padding(16.dp), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            }
        } else if (products.isEmpty()) {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Товаров пока нет", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Администратор добавит и включит товары в каталоге.", Modifier.padding(top = 5.dp), color = UtpMuted, fontSize = 12.sp)
                }
            }
        } else {
            products.forEach { product ->
                CustomerShopProductCard(
                    product = product,
                    quantity = cart[product.id] ?: 0,
                    onAdd = { setQuantity(product.id, (cart[product.id] ?: 0) + 1) },
                )
            }
        }

        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Корзина · ${cart.values.sum()} шт.", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                if (cartItems.isEmpty()) {
                    Text("Добавьте товары, чтобы отправить заказ.", fontSize = 12.sp, color = UtpMuted)
                } else {
                    cartItems.forEach { product ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.weight(1f)) {
                                Text(product.name, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = UtpInk)
                                Text(shopPrice(product.unitPriceRub * (cart[product.id] ?: 0)), fontSize = 12.sp, color = UtpMuted)
                            }
                            OutlinedButton(onClick = { setQuantity(product.id, (cart[product.id] ?: 0) - 1) }) { Text("−") }
                            Text("${cart[product.id]}", Modifier.padding(horizontal = 8.dp), color = UtpInk)
                            OutlinedButton(
                                onClick = { setQuantity(product.id, (cart[product.id] ?: 0) + 1) },
                                enabled = (cart[product.id] ?: 0) < 100,
                            ) { Text("+") }
                        }
                        if (product.availability == "OUT_OF_STOCK") {
                            Text("${product.name}: нет в наличии — удалите товар из корзины.", color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 11.sp)
                        }
                    }
                    OutlinedTextField(
                        value = customerNote,
                        onValueChange = { customerNote = it.take(1000) },
                        label = { Text("Комментарий администратору (необязательно)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Итого", fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(shopPrice(totalRub), fontWeight = FontWeight.Bold, color = UtpInk)
                    }
                    Button(
                        onClick = {
                            runAction({ ApiClient.createShopOrder(token, cart, customerNote) }) { result ->
                                (result as? ShopOrder)?.let {
                                    cart = emptyMap()
                                    customerNote = ""
                                    saveShopCart(context, user.id, emptyMap())
                                    successMessage = "Заказ отправлен. Администратор проверит наличие и свяжется с вами для согласования оплаты и получения."
                                    scope.launch { reload() }
                                }
                            }
                        },
                        enabled = cartItems.isNotEmpty() && !hasOutOfStock && !isLoading,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Отправить заказ · ${shopPrice(totalRub)}")
                    }
                    Text(
                        "Остаток резервируется после проверки администратором. Оплата и получение согласуются отдельно, онлайн-оплаты нет.",
                        fontSize = 11.sp,
                        color = UtpMuted,
                    )
                }
            }
        }

        Text("Мои заказы магазина", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        if (orders.isEmpty() && !isLoading) {
            Text("Пока нет заказов.", fontSize = 12.sp, color = UtpMuted)
        }
        orders.forEach { order ->
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Заказ #${order.id.take(8)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(shopOrderStatus(order.status), color = UtpBlue, fontSize = 12.sp)
                    }
                    order.items.forEach { item ->
                        Text("${item.name} × ${item.quantity} — ${shopPrice(item.quantity * item.unitPriceRub)}", fontSize = 12.sp, color = UtpMuted)
                    }
                    Text("Итого: ${shopPrice(order.totalRub)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun CustomerShopProductCard(
    product: ShopProduct,
    quantity: Int,
    onAdd: () -> Unit,
) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("📦", fontSize = 28.sp, modifier = Modifier.padding(end = 12.dp))
            Column(Modifier.weight(1f)) {
                Text(product.name, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(shopPrice(product.unitPriceRub), fontSize = 13.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
                Text(productAvailability(product.availability), fontSize = 11.sp, color = if (product.availability == "OUT_OF_STOCK") androidx.compose.material3.MaterialTheme.colorScheme.error else UtpBlue, modifier = Modifier.padding(top = 3.dp))
            }
            if (product.availability == "OUT_OF_STOCK") {
                Text("Нет в наличии", fontSize = 11.sp, color = UtpMuted)
            } else {
                Button(onClick = onAdd, shape = RoundedCornerShape(12.dp)) {
                    Text(if (quantity > 0) "В корзине: $quantity" else "В корзину")
                }
            }
        }
    }
}
