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
import androidx.compose.foundation.layout.size
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
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.ShopOrder
import ru.utp.servise.data.ShopProduct
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.StaffMember
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

private data class CustomerShopSnapshot(
    val products: List<ShopProduct>,
    val orders: List<ShopOrder>,
    val crafts: List<CraftItem>,
    val craftOrders: List<CraftOrder>,
)

private data class ShopCartLine(
    val key: String,
    val title: String,
    val unitPriceRub: Int,
    val quantity: Int,
    val availableQuantity: Int?,
)

@Composable
fun CustomerShopScreen(
    user: AppUser,
    token: String,
    runAction: RunAction,
    onBack: () -> Unit,
    initialTab: String = "PRODUCTS",
    staff: List<StaffMember> = emptyList(),
    banners: List<SiteBanner> = emptyList(),
    onCampaignNavigate: (String) -> Unit = {},
    onRefresh: () -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    var products by remember { mutableStateOf<List<ShopProduct>>(emptyList()) }
    var orders by remember { mutableStateOf<List<ShopOrder>>(emptyList()) }
    var crafts by remember { mutableStateOf<List<CraftItem>>(emptyList()) }
    var craftOrders by remember { mutableStateOf<List<CraftOrder>>(emptyList()) }
    var selectedTab by remember(user.id) { mutableStateOf(initialTab) }
    var cart by remember(user.id) { mutableStateOf(readShopCart(context, user.id)) }
    var customerNote by remember(user.id) { mutableStateOf("") }
    var deliveryMethod by remember(user.id) { mutableStateOf("PICKUP") }
    var deliveryArea by remember(user.id) { mutableStateOf("MOSCOW") }
    var deliveryCity by remember(user.id) { mutableStateOf("Москва") }
    var deliveryAddress by remember(user.id) { mutableStateOf("") }
    var deliveryRequestNote by remember(user.id) { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        isLoading = true
        loadError = null
        try {
            val loaded = withContext(Dispatchers.IO) {
                CustomerShopSnapshot(
                    products = ApiClient.shopProducts(),
                    orders = ApiClient.customerShopOrders(token),
                    crafts = ApiClient.craftItems(token),
                    craftOrders = ApiClient.craftOrders(token),
                )
            }
            products = loaded.products
            orders = loaded.orders
            crafts = loaded.crafts
            craftOrders = loaded.craftOrders
            val validIds = loaded.products.map { it.id }.toSet() +
                loaded.crafts.filter { it.stockQuantity > 0 }.map { "craft:${it.id}" }
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

    fun setQuantity(productId: String, quantity: Int, maximum: Int = 100) {
        val nextCart = if (quantity < 1) {
            cart - productId
        } else {
            cart + (productId to quantity.coerceAtMost(maximum))
        }
        cart = nextCart
        saveShopCart(context, user.id, nextCart)
    }

    val cartLines = products.mapNotNull { product ->
        val quantity = cart[product.id] ?: return@mapNotNull null
        ShopCartLine(
            key = product.id,
            title = product.name,
            unitPriceRub = product.unitPriceRub,
            quantity = quantity,
            availableQuantity = if (product.availability == "OUT_OF_STOCK") 0 else null,
        )
    } + crafts.mapNotNull { craft ->
        val key = "craft:${craft.id}"
        val quantity = cart[key] ?: return@mapNotNull null
        ShopCartLine(key, craft.title, craft.priceRub, quantity, craft.stockQuantity)
    }
    val totalRub = cartLines.sumOf { it.unitPriceRub * it.quantity }
    val hasOutOfStock = cartLines.any { line ->
        line.availableQuantity?.let { it < line.quantity } ?: false
    }
    val shopCart = cart.filterKeys { !it.startsWith("craft:") }
    val craftCart = cart.filterKeys { it.startsWith("craft:") }
        .mapKeys { (key, _) -> key.removePrefix("craft:") }

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

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            ShopTabButton("Товары", selectedTab == "PRODUCTS", Modifier.weight(1f)) { selectedTab = "PRODUCTS" }
            ShopTabButton("Рукоделие", selectedTab == "CRAFTS", Modifier.weight(1f)) { selectedTab = "CRAFTS" }
            ShopTabButton("Корзина · ${cartLines.sumOf { it.quantity }}", selectedTab == "CART", Modifier.weight(1f)) { selectedTab = "CART" }
        }

        if (selectedTab == "PRODUCTS" && isLoading && products.isEmpty()) {
            Text("Загружаем товары…", color = UtpMuted)
        } else if (selectedTab == "PRODUCTS" && loadError != null && products.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text(loadError.orEmpty(), Modifier.fillMaxWidth().padding(16.dp), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            }
        } else if (selectedTab == "PRODUCTS" && products.isEmpty()) {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Товаров пока нет", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Администратор добавит и включит товары в каталоге.", Modifier.padding(top = 5.dp), color = UtpMuted, fontSize = 12.sp)
                }
            }
        } else if (selectedTab == "PRODUCTS") {
            products.forEach { product ->
                CustomerShopProductCard(
                    product = product,
                    token = token,
                    quantity = cart[product.id] ?: 0,
                    onAdd = { setQuantity(product.id, (cart[product.id] ?: 0) + 1) },
                )
            }
        } else if (selectedTab == "CRAFTS") {
            CraftsScreen(
                token = token,
                isAdmin = false,
                items = crafts,
                orders = craftOrders,
                staff = staff,
                runAction = runAction,
                refresh = { onRefresh(); scope.launch { reload() } },
                onBack = {},
                banners = banners,
                onCampaignNavigate = onCampaignNavigate,
                embedded = true,
                onAddToShopCart = { item ->
                    val key = "craft:${item.id}"
                    setQuantity(key, (cart[key] ?: 0) + 1, item.stockQuantity)
                    selectedTab = "CART"
                },
            )
        }

        if (selectedTab == "CART") {
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Корзина · ${cartLines.sumOf { it.quantity }} шт.", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                if (cartLines.isEmpty()) {
                    Text("Добавьте товары, чтобы отправить заказ.", fontSize = 12.sp, color = UtpMuted)
                } else {
                    cartLines.forEach { line ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.weight(1f)) {
                                Text(line.title, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = UtpInk)
                                Text(shopPrice(line.unitPriceRub * line.quantity), fontSize = 12.sp, color = UtpMuted)
                            }
                            OutlinedButton(onClick = { setQuantity(line.key, line.quantity - 1) }) { Text("−") }
                            Text("${line.quantity}", Modifier.padding(horizontal = 8.dp), color = UtpInk)
                            OutlinedButton(
                                onClick = { setQuantity(line.key, line.quantity + 1, line.availableQuantity ?: 100) },
                                enabled = line.quantity < (line.availableQuantity ?: 100),
                            ) { Text("+") }
                        }
                        if (line.availableQuantity != null && line.quantity > line.availableQuantity) {
                            Text("${line.title}: доступно ${line.availableQuantity} шт. Измените количество.", color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 11.sp)
                        }
                    }
                    OutlinedTextField(
                        value = customerNote,
                        onValueChange = { customerNote = it.take(1000) },
                        label = { Text("Комментарий администратору (необязательно)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    CustomerShopDeliveryForm(
                        deliveryMethod = deliveryMethod,
                        onDeliveryMethodChange = { deliveryMethod = it },
                        deliveryArea = deliveryArea,
                        onDeliveryAreaChange = { area ->
                            deliveryArea = area
                            deliveryCity = if (area == "MOSCOW") "Москва" else ""
                        },
                        deliveryCity = deliveryCity,
                        onDeliveryCityChange = { deliveryCity = it },
                        deliveryAddress = deliveryAddress,
                        onDeliveryAddressChange = { deliveryAddress = it },
                        deliveryRequestNote = deliveryRequestNote,
                        onDeliveryRequestNoteChange = { deliveryRequestNote = it },
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Итого", fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(shopPrice(totalRub), fontWeight = FontWeight.Bold, color = UtpInk)
                    }
                    Button(
                        onClick = {
                            runAction({
                                ApiClient.createShopOrder(
                                    token = token,
                                    items = shopCart,
                                    craftItems = craftCart,
                                    customerNote = customerNote,
                                    deliveryMethod = deliveryMethod,
                                    deliveryArea = deliveryArea,
                                    deliveryCity = deliveryCity,
                                    deliveryAddress = deliveryAddress,
                                    deliveryRequestNote = deliveryRequestNote,
                                )
                            }) { result ->
                                (result as? ShopOrder)?.let { createdOrder ->
                                    cart = emptyMap()
                                    customerNote = ""
                                    deliveryMethod = "PICKUP"
                                    deliveryArea = "MOSCOW"
                                    deliveryCity = "Москва"
                                    deliveryAddress = ""
                                    deliveryRequestNote = ""
                                    saveShopCart(context, user.id, emptyMap())
                                    successMessage = if (createdOrder.deliveryMethod == "COURIER") {
                                        "Заказ доставки отправлен. Администратор проверит адрес и сообщит стоимость и срок."
                                    } else {
                                        "Заказ отправлен. Администратор проверит наличие и свяжется с вами для согласования оплаты и получения."
                                    }
                                    scope.launch { reload() }
                                }
                            }
                        },
                        enabled = cartLines.isNotEmpty() && !hasOutOfStock && !isLoading &&
                            (deliveryMethod == "PICKUP" ||
                                (deliveryCity.isNotBlank() && deliveryAddress.isNotBlank())),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Отправить заказ · ${shopPrice(totalRub)}")
                    }
                    Text(
                        "Наличие проверит администратор. Для доставки он сначала предложит цену и срок; заказ будет подтверждён после вашего согласия. Онлайн-оплаты нет.",
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
            CustomerShopOrderCard(
                order = order,
                onAcceptDelivery = {
                    runAction({ ApiClient.respondToShopDeliveryOffer(token, order.id, accept = true) }) { result ->
                        (result as? ShopOrder)?.let { updated ->
                            orders = orders.map { if (it.id == updated.id) updated else it }
                            successMessage = "Вы согласились с условиями доставки. Администратор подтвердит наличие товара."
                            scope.launch { reload() }
                        }
                    }
                },
                onDeclineDelivery = {
                    runAction({ ApiClient.respondToShopDeliveryOffer(token, order.id, accept = false) }) { result ->
                        (result as? ShopOrder)?.let { updated ->
                            orders = orders.map { if (it.id == updated.id) updated else it }
                            successMessage = "Предложение отклонено, заказ отменён."
                            scope.launch { reload() }
                        }
                    }
                },
            )
        }
        Text("Заявки на изготовление", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        if (craftOrders.isEmpty() && !isLoading) {
            Text("Пока нет заявок на рукоделие.", fontSize = 12.sp, color = UtpMuted)
        }
        craftOrders.forEach { order ->
            CustomerCraftOrderCard(order, token, runAction) { onRefresh(); scope.launch { reload() } }
        }
        Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun ShopTabButton(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    if (selected) {
        Button(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(12.dp)) {
            Text(label, fontSize = 11.sp, maxLines = 1)
        }
    } else {
        OutlinedButton(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(12.dp)) {
            Text(label, fontSize = 11.sp, maxLines = 1)
        }
    }
}

@Composable
private fun CustomerShopProductCard(
    product: ShopProduct,
    token: String,
    quantity: Int,
    onAdd: () -> Unit,
) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (product.imageObjectIds.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    product.imageObjectIds.take(4).forEachIndexed { index, objectId ->
                        RemoteProjectImage(
                            objectId = objectId,
                            token = token,
                            modifier = Modifier.size(64.dp),
                            contentDescription = "Фото ${index + 1}: ${product.name}",
                        )
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
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
            product.description?.takeIf { it.isNotBlank() }?.let {
                Text(it, fontSize = 12.sp, lineHeight = 18.sp, color = UtpMuted)
            }
        }
    }
}
