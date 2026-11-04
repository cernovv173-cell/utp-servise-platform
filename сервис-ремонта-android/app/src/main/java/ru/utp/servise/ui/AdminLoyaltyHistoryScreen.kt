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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.AdminLoyaltyCustomer
import ru.utp.servise.data.AdminMarketingApi
import ru.utp.servise.data.LoyaltyTransaction
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun AdminLoyaltyHistoryScreen(
    token: String,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var customers by remember { mutableStateOf(emptyList<AdminLoyaltyCustomer>()) }
    var search by remember { mutableStateOf("") }
    var expandedId by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    fun load() {
        scope.launch {
            loading = true
            try {
                customers = withContext(Dispatchers.IO) { AdminMarketingApi.loyaltyCustomers(token) }
            } catch (failure: Throwable) {
                onError(failure.message ?: "Не удалось загрузить историю бонусов.")
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(token) { load() }
    val visibleCustomers = customers.filter {
        it.displayName.contains(search, ignoreCase = true) ||
            it.email?.contains(search, ignoreCase = true) == true
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("←  Управление") }
            Text("Бонусные балансы", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                "История операций клиентов (только просмотр).",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Поиск клиента или почты") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                shape = RoundedCornerShape(12.dp),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    "Клиентов: ${visibleCustomers.size}",
                    color = UtpMuted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
                TextButton(onClick = ::load, enabled = !loading) { Text("Обновить") }
            }
            if (loading) Text("Загрузка…", color = UtpMuted)
            else if (visibleCustomers.isEmpty()) Text("Клиенты не найдены.", color = UtpMuted)
        }
        items(visibleCustomers, key = { it.id }) { customer ->
            val expanded = expandedId == customer.id
            Card(
                modifier = Modifier.fillMaxWidth().clickable {
                    expandedId = if (expanded) null else customer.id
                },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
                ),
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(customer.displayName, fontWeight = FontWeight.SemiBold, color = UtpInk)
                            Text(customer.email ?: "Почта не указана", fontSize = 11.sp, color = UtpMuted)
                        }
                        Text("${customer.balance} баллов", fontWeight = FontWeight.Bold, color = UtpBlue)
                    }
                    val historyAction = if (expanded) "свернуть" else "показать"
                    Text(
                        "${customer.transactions.size} операций · $historyAction",
                        fontSize = 11.sp,
                        color = UtpMuted,
                    )
                    if (expanded) {
                        if (customer.transactions.isEmpty()) {
                            Text("Операций нет.", fontSize = 12.sp, color = UtpMuted)
                        }
                        customer.transactions.forEach { transaction ->
                            LoyaltyTransactionRow(transaction)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoyaltyTransactionRow(transaction: LoyaltyTransaction) {
    val formatter = remember {
        DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.systemDefault())
    }
    val date = runCatching { formatter.format(Instant.parse(transaction.createdAt)) }
        .getOrDefault(transaction.createdAt.take(16))
    Row(
        Modifier.fillMaxWidth().padding(top = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(Modifier.weight(1f)) {
            Text(transaction.reason, fontSize = 12.sp, color = UtpInk)
            Text(
                listOfNotNull(date, transaction.serviceNumber).joinToString(" · "),
                fontSize = 10.sp,
                color = UtpMuted,
            )
        }
        Text(
            "${if (transaction.points > 0) "+" else ""}${transaction.points}",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (transaction.points < 0) androidx.compose.material3.MaterialTheme.colorScheme.error else UtpBlue,
        )
    }
}
