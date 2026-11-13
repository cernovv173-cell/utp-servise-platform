package ru.utp.servise.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.ShopProduct
import ru.utp.servise.data.readShopCart
import ru.utp.servise.data.saveShopCart

private data class ShopItemLookup(
    val product: ShopProduct? = null,
    val craft: CraftItem? = null,
)

@Composable
fun CustomerShopProductDetailScreen(
    kind: String,
    itemId: String,
    token: String,
    customerId: String,
    onBack: () -> Unit,
    onOpenCart: () -> Unit,
    onOpenCustomOrder: () -> Unit,
) {
    val context = LocalContext.current
    var product by remember(itemId) { mutableStateOf<ShopProduct?>(null) }
    var craft by remember(itemId) { mutableStateOf<CraftItem?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var cart by remember(customerId) { mutableStateOf(readShopCart(context, customerId)) }
    var selectedPhoto by remember(kind, itemId) { mutableStateOf(0) }

    LaunchedEffect(kind, itemId, token) {
        isLoading = true
        errorMessage = null
        product = null
        craft = null
        try {
            val loadedItem = withContext(Dispatchers.IO) {
                when (kind) {
                    "product" -> ShopItemLookup(product = ApiClient.shopProducts().firstOrNull { it.id == itemId })
                    "craft" -> ShopItemLookup(craft = ApiClient.craftItems(token).firstOrNull { it.id == itemId && it.isPublished })
                    else -> error("Карточка товара не найдена.")
                }
            }
            product = loadedItem.product
            craft = loadedItem.craft
            if (product == null && craft == null) errorMessage = "Товар не найден или больше не опубликован."
        } catch (failure: Exception) {
            errorMessage = failure.message ?: "Не удалось загрузить карточку товара."
        } finally {
            isLoading = false
        }
    }

    val cartKey = when {
        product != null -> product!!.id
        craft != null -> "craft:${craft!!.id}"
        else -> null
    }
    val quantity = cartKey?.let { cart[it] } ?: 0
    val maximumQuantity = when {
        product?.availability == "OUT_OF_STOCK" -> 0
        product != null -> 100
        craft != null -> craft!!.stockQuantity
        else -> 0
    }
    val isAvailable = maximumQuantity > quantity
    val title = product?.name ?: craft?.title.orEmpty()
    val description = product?.description?.takeIf { it.isNotBlank() }
        ?: craft?.description?.takeIf { it.isNotBlank() }
        ?: "Описание пока не добавлено."
    val priceRub = product?.unitPriceRub ?: craft?.priceRub
    val loadedProduct = product
    val loadedCraft = craft
    val photos = when {
        loadedProduct != null -> loadedProduct.imageObjectIds.take(3)
        loadedCraft != null -> loadedCraft.imageObjectIds.take(3)
            .ifEmpty { listOfNotNull(loadedCraft.imageObjectId) }
        else -> emptyList()
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onBack, modifier = Modifier.align(Alignment.Start)) { Text("←  В магазин") }

        when {
            isLoading -> Text("Загружаем карточку товара…", color = UtpMuted)
            errorMessage != null && product == null && craft == null -> {
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(errorMessage.orEmpty(), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                        OutlinedButton(onClick = onBack) { Text("Вернуться в магазин") }
                    }
                }
            }
            product != null || craft != null -> {
                Text(if (craft != null) "ГОТОВОЕ ИЗДЕЛИЕ · РУЧНАЯ РАБОТА" else "МАГАЗИН", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
                Text(title, fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold, color = UtpInk)

                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (photos.isNotEmpty()) {
                            RemoteProjectImage(
                                objectId = photos.getOrNull(selectedPhoto),
                                token = token,
                                modifier = Modifier.fillMaxWidth().height(300.dp),
                                contentDescription = "Фото товара: $title",
                            )
                            if (photos.size > 1) {
                                Row(
                                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    photos.forEachIndexed { index, objectId ->
                                        TextButton(
                                            onClick = { selectedPhoto = index },
                                            modifier = Modifier.background(
                                                if (selectedPhoto == index) UtpMint else androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant,
                                                RoundedCornerShape(10.dp),
                                            ),
                                        ) {
                                            RemoteProjectImage(
                                                objectId = objectId,
                                                token = token,
                                                modifier = Modifier.size(58.dp),
                                                contentDescription = "Фото ${index + 1}: $title",
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            Box(
                                Modifier.fillMaxWidth().height(220.dp).background(UtpMint, RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("Фото пока не добавлено", color = UtpMuted, fontSize = 13.sp)
                            }
                        }

                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(priceRub?.let(::shopPrice) ?: "Цена уточняется", fontSize = 27.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
                                Spacer(Modifier.height(5.dp))
                                Text(
                                    when {
                                        product?.availability == "IN_STOCK" -> "Есть в наличии"
                                        product?.availability == "OUT_OF_STOCK" -> "Нет в наличии"
                                        product != null -> "Наличие уточнит администратор"
                                        craft?.stockQuantity ?: 0 > 0 -> "Готово сейчас · ${craft?.stockQuantity} шт."
                                        else -> "Пока нет готовых экземпляров"
                                    },
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (isAvailable) UtpBlue else UtpMuted,
                                )
                            }
                        }

                        Button(
                            onClick = {
                                val key = cartKey ?: return@Button
                                val nextCart = cart + (key to (quantity + 1).coerceAtMost(maximumQuantity))
                                cart = nextCart
                                saveShopCart(context, customerId, nextCart)
                                Toast.makeText(context, "Добавлено в корзину.", Toast.LENGTH_SHORT).show()
                            },
                            enabled = isAvailable && cartKey != null,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(if (isAvailable) "В корзину" else "Нет в наличии")
                        }
                        if (quantity > 0) {
                            Text("В корзине: $quantity шт.", fontSize = 12.sp, color = UtpMuted)
                            OutlinedButton(onClick = onOpenCart, modifier = Modifier.fillMaxWidth()) {
                                Text("Перейти к корзине и заказу")
                            }
                        }
                        if (craft?.customOrderAvailable == true && craft?.stockQuantity == 0) {
                            OutlinedButton(onClick = onOpenCustomOrder, modifier = Modifier.fillMaxWidth()) {
                                Text("Обсудить изготовление на заказ")
                            }
                        }
                        Text(
                            "Заказ отправляется как заявка. Наличие подтвердит администратор; онлайн-оплаты нет.",
                            fontSize = 11.sp,
                            lineHeight = 16.sp,
                            color = UtpMuted,
                        )
                    }
                }

                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text("Описание", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(description, fontSize = 13.sp, lineHeight = 20.sp, color = UtpMuted)
                        if (craft != null) Text("Изделие ручной работы", fontSize = 12.sp, color = UtpBlue)
                    }
                }
            }
        }
    }
}

private fun shopPrice(amount: Int): String =
    "${java.text.NumberFormat.getIntegerInstance(java.util.Locale("ru", "RU")).format(amount)} ₽"
