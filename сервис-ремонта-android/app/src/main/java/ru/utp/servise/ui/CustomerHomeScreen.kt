package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.statusLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun CustomerHomeScreen(
    user: AppUser,
    orders: List<RepairOrder>,
    onCreateRequest: () -> Unit,
    onOrders: () -> Unit,
    onShop: () -> Unit,
    onLoyalty: () -> Unit,
    onNews: () -> Unit,
    onOffers: () -> Unit,
) {
    val activeOrders = remember(orders) { customerHomeActiveOrders(orders) }
    var companyPhone by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        companyPhone = withContext(Dispatchers.IO) {
            runCatching { ApiClient.companyInfo().phone }.getOrDefault("")
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("Добро пожаловать", fontSize = 13.sp, color = UtpMuted)
            Text(
                text = user.displayName.substringBefore(' ').ifBlank { "Клиент" },
                fontSize = 25.sp,
                fontWeight = FontWeight.Bold,
                color = UtpInk,
            )
        }

        HolidayClosureBanner(phoneNumber = companyPhone)

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = UtpMint),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Text(
                    text = "Нужен ремонт?",
                    fontSize = 22.sp,
                    lineHeight = 27.sp,
                    fontWeight = FontWeight.Bold,
                    color = UtpInk,
                )
                Text(
                    text = "Опишите неисправность — сервис поможет с дальнейшими шагами.",
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    color = UtpMuted,
                )
                Button(
                    onClick = onCreateRequest,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text("Оставить заявку")
                }
            }
        }

        if (activeOrders.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Текущий ремонт",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
                CustomerActiveRepairCard(
                    order = activeOrders.first(),
                    activeCount = activeOrders.size,
                    onClick = onOrders,
                )
            }
        }

        CustomerOfferHomeBanners(
            onOpenOffers = onOffers,
            modifier = Modifier.fillMaxWidth(),
            compact = true,
        )

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Быстрый доступ",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
            )
            DashboardQuickActionsGrid(
                listOf(
                    DashboardAction("Мои ремонты", "Статус и история", Icons.AutoMirrored.Filled.List, onOrders),
                    DashboardAction("Магазин", "Товары и изделия", Icons.Filled.ShoppingCart, onShop),
                    DashboardAction("Бонусы", "Программа лояльности", Icons.Filled.Star, onLoyalty),
                    DashboardAction("Новости", "Новости и отзывы", Icons.Filled.Info, onNews),
                ),
            )
        }

        Spacer(Modifier.height(2.dp))
    }
}

internal fun customerHomeActiveOrders(orders: List<RepairOrder>): List<RepairOrder> =
    prioritizeRepairOrders(
        orders.filter { it.archivedAt == null && it.status !in listOf("COMPLETED", "CANCELLED") },
        role = "CUSTOMER",
    )

@Composable
private fun CustomerActiveRepairCard(
    order: RepairOrder,
    activeCount: Int,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = order.status.statusLabel(),
                    modifier = Modifier.weight(1f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpBlue,
                )
                Text(
                    text = if (activeCount > 1) "Ещё ${activeCount - 1}" else "Открыть →",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
            }
            Text(
                text = listOf(order.serviceNumber, order.deviceType.deviceLabel())
                    .filter(String::isNotBlank)
                    .joinToString(" · "),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = order.problem,
                fontSize = 12.sp,
                color = UtpMuted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
