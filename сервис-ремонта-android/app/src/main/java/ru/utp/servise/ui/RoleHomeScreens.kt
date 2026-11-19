package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.statusLabel

@Composable
fun TechnicianHomeScreen(
    user: AppUser,
    orders: List<RepairOrder>,
    onOrders: () -> Unit,
    onCatalog: () -> Unit,
    onSalary: () -> Unit,
    onProfile: () -> Unit,
) {
    val summary = remember(orders) { technicianDashboardSummary(orders) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            DashboardGreeting(
                name = user.displayName.substringBefore(' ').ifBlank { "Мастер" },
                subtitle = "Рабочий экран мастера",
            )
        }
        item {
            Card(
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    Text("Назначенные ремонты", fontSize = 13.sp, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(
                        summary.activeCount.toString(),
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        "Срочных: ${summary.urgentCount}",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Button(onClick = onOrders, modifier = Modifier.fillMaxWidth()) {
                        Text("Открыть заказы")
                    }
                }
            }
        }
        item {
            DashboardSectionTitle("Быстрый доступ")
            DashboardQuickActionsGrid(
                listOf(
                    DashboardAction("Мои заказы", "Назначенные ремонты", Icons.AutoMirrored.Filled.List, onOrders),
                    DashboardAction("Каталог", "Работы и запчасти", Icons.Filled.Search, onCatalog),
                    DashboardAction("Зарплата", "Начисления", Icons.Filled.Star, onSalary),
                    DashboardAction("Профиль", "Анкета и настройки", Icons.Filled.Person, onProfile),
                ),
            )
        }
        item {
            DashboardSectionTitle("Следующий ремонт")
            summary.nextOrder?.let { order ->
                DashboardRepairOrderCard(order, onOrders)
            } ?: DashboardEmptyCard("Активных назначенных ремонтов пока нет.")
        }
    }
}

@Composable
fun AdministratorHomeScreen(
    orders: List<RepairOrder>,
    onOrders: () -> Unit,
    onSchedule: () -> Unit,
    onCustomers: () -> Unit,
    onManagement: () -> Unit,
    onCatalog: () -> Unit,
) {
    val summary = remember(orders) { administratorDashboardSummary(orders) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            DashboardGreeting(
                name = "Администратор Енот-сервис.рф",
                subtitle = "Обзор сервиса",
            )
        }
        item {
            Card(
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    Text("Требуют внимания", fontSize = 13.sp, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(
                        summary.actionRequiredCount.toString(),
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        "Новые заявки, сметы и акты",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Button(onClick = onOrders, modifier = Modifier.fillMaxWidth()) {
                        Text("К списку заявок")
                    }
                }
            }
        }
        item {
            DashboardSectionTitle("Сейчас в сервисе")
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    DashboardMetricTile("Новые", summary.newRequestCount, Icons.Filled.Info, Modifier.weight(1f))
                    DashboardMetricTile("В работе", summary.activeRepairCount, Icons.Filled.Build, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    DashboardMetricTile("К выдаче", summary.readyForPickupCount, Icons.Filled.ShoppingCart, Modifier.weight(1f))
                    DashboardMetricTile("Срочные", summary.urgentCount, Icons.Filled.Star, Modifier.weight(1f))
                }
            }
        }
        item {
            DashboardSectionTitle("Быстрый доступ")
            DashboardQuickActionsGrid(
                listOf(
                    DashboardAction("Заявки", "Новые и активные", Icons.AutoMirrored.Filled.List, onOrders),
                    DashboardAction("Расписание", "Загрузка мастеров", Icons.AutoMirrored.Filled.List, onSchedule),
                    DashboardAction("Клиенты", "Поиск и карточки", Icons.Filled.Person, onCustomers),
                    DashboardAction("Управление", "Разделы сервиса", Icons.Filled.Settings, onManagement),
                    DashboardAction("Каталог", "Услуги и запчасти", Icons.Filled.Search, onCatalog),
                ),
            )
        }
        item {
            DashboardSectionTitle("Ближайшее действие")
            summary.nextActionOrder?.let { order ->
                DashboardRepairOrderCard(order, onOrders)
            } ?: DashboardEmptyCard("Сейчас нет заявок, требующих решения.")
        }
    }
}

internal data class TechnicianDashboardSummary(
    val activeCount: Int,
    val urgentCount: Int,
    val nextOrder: RepairOrder?,
)

internal fun technicianDashboardSummary(orders: List<RepairOrder>): TechnicianDashboardSummary {
    val activeOrders = activeDashboardOrders(orders)
    return TechnicianDashboardSummary(
        activeCount = activeOrders.size,
        urgentCount = activeOrders.count { it.priority == "URGENT" },
        nextOrder = prioritizeRepairOrders(activeOrders, "TECHNICIAN").firstOrNull(),
    )
}

internal data class AdministratorDashboardSummary(
    val actionRequiredCount: Int,
    val newRequestCount: Int,
    val activeRepairCount: Int,
    val readyForPickupCount: Int,
    val urgentCount: Int,
    val nextActionOrder: RepairOrder?,
)

internal fun administratorDashboardSummary(orders: List<RepairOrder>): AdministratorDashboardSummary {
    val activeOrders = activeDashboardOrders(orders)
    val ordersRequiringAction = activeOrders.filter(::requiresAdministratorAction)
    return AdministratorDashboardSummary(
        actionRequiredCount = ordersRequiringAction.size,
        newRequestCount = activeOrders.count { it.status == "REQUESTED" },
        activeRepairCount = activeOrders.count { it.status == "ASSIGNED" || it.status == "IN_PROGRESS" },
        readyForPickupCount = activeOrders.count { it.status == "READY_FOR_PICKUP" },
        urgentCount = activeOrders.count { it.priority == "URGENT" },
        nextActionOrder = prioritizeRepairOrders(ordersRequiringAction, "ADMIN").firstOrNull(),
    )
}

private fun activeDashboardOrders(orders: List<RepairOrder>): List<RepairOrder> =
    orders.filter { order ->
        order.archivedAt == null && order.status !in listOf("COMPLETED", "CANCELLED")
    }

private fun requiresAdministratorAction(order: RepairOrder): Boolean =
    order.status == "REQUESTED" ||
        order.estimates.lastOrNull()?.status == "PENDING" ||
        order.workAct?.status == "PENDING"

@Composable
private fun DashboardSectionTitle(title: String) {
    Text(
        title,
        modifier = Modifier.padding(bottom = 8.dp),
        fontSize = 17.sp,
        fontWeight = FontWeight.SemiBold,
        color = UtpInk,
    )
}

@Composable
private fun DashboardMetricTile(title: String, value: Int, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(17.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            androidx.compose.material3.Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Text(title, fontSize = 12.sp, color = UtpMuted)
            Text(value.toString(), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        }
    }
}

@Composable
private fun DashboardRepairOrderCard(order: RepairOrder, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(order.status.statusLabel(), fontSize = 12.sp, color = UtpBlue, fontWeight = FontWeight.SemiBold)
            Text(
                listOf(order.serviceNumber, order.deviceType.deviceLabel())
                    .filter(String::isNotBlank)
                    .joinToString(" · "),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                order.problem,
                fontSize = 12.sp,
                color = UtpMuted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun DashboardEmptyCard(message: String) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Text(message, modifier = Modifier.padding(16.dp), fontSize = 13.sp, color = UtpMuted)
    }
}
