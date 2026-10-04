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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.AdminCustomer
import ru.utp.servise.data.AdminCustomerPage
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.NewAdminCustomerResult

@Composable
fun CustomerManagementScreen(
    token: String,
    runAction: RunAction,
    onBack: () -> Unit,
) {
    var searchText by remember { mutableStateOf("") }
    var appliedSearch by remember { mutableStateOf("") }
    var page by remember { mutableStateOf(1) }
    var loadRevision by remember { mutableStateOf(0) }
    var totalPages by remember { mutableStateOf(0) }
    var totalItems by remember { mutableStateOf(0) }
    var customers by remember { mutableStateOf<List<AdminCustomer>>(emptyList()) }
    var editingCustomer by remember { mutableStateOf<AdminCustomer?>(null) }
    var showCreateCustomer by remember { mutableStateOf(false) }
    var newCustomerCredentials by remember { mutableStateOf<NewAdminCustomerResult?>(null) }

    LaunchedEffect(appliedSearch, page, loadRevision) {
        runAction({ ApiClient.administratorCustomers(token, appliedSearch, page) }) { result ->
            (result as? AdminCustomerPage)?.let { loaded ->
                customers = loaded.customers
                totalPages = loaded.totalPages
                totalItems = loaded.totalItems
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление") }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("База клиентов", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("$totalItems клиентов · изменяйте только контактные данные", fontSize = 12.sp, color = UtpMuted)
            }
            Column(horizontalAlignment = Alignment.End) {
                Button(onClick = { showCreateCustomer = true }, shape = RoundedCornerShape(12.dp)) { Text("Добавить") }
                TextButton(onClick = { page = 1; appliedSearch = searchText.trim(); loadRevision += 1 }) { Text("Обновить") }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it.take(120) },
                label = { Text("Имя, почта или телефон") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(13.dp),
            )
            Button(onClick = { page = 1; appliedSearch = searchText.trim(); loadRevision += 1 }, shape = RoundedCornerShape(12.dp)) {
                Text("Найти")
            }
        }
        if (customers.isEmpty()) {
            Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text(
                    if (appliedSearch.isBlank()) "Клиенты не найдены." else "По этому запросу клиентов нет.",
                    Modifier.padding(16.dp), color = UtpMuted,
                )
            }
        }
        customers.forEach { customer ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(customer.displayName, fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.weight(1f))
                        Text(if (customer.active) "Активен" else "Отключён", fontSize = 11.sp, color = if (customer.active) UtpBlue else UtpMuted)
                    }
                    Text(customer.email, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
                    Text(customer.phoneNumber?.ifBlank { null } ?: "Телефон не указан", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp))
                    TextButton(onClick = { editingCustomer = customer }, modifier = Modifier.align(Alignment.End)) {
                        Text("Изменить данные")
                    }
                }
            }
        }
        if (totalPages > 1) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = { page -= 1 }, enabled = page > 1, shape = RoundedCornerShape(12.dp)) { Text("Назад") }
                Text("Страница $page из $totalPages", fontSize = 12.sp, color = UtpMuted)
                OutlinedButton(onClick = { page += 1 }, enabled = page < totalPages, shape = RoundedCornerShape(12.dp)) { Text("Далее") }
            }
        }
        Spacer(Modifier.height(12.dp))
    }

    editingCustomer?.let { customer ->
        EditCustomerDialog(
            customer = customer,
            onDismiss = { editingCustomer = null },
            onSave = { updated ->
                runAction({ ApiClient.updateAdministratorCustomer(token, updated) }) { result ->
                    (result as? AdminCustomer)?.let { saved ->
                        customers = customers.map { if (it.id == saved.id) saved else it }
                        editingCustomer = null
                        loadRevision += 1
                    }
                }
            },
        )
    }
    if (showCreateCustomer) {
        CreateCustomerDialog(
            onDismiss = { showCreateCustomer = false },
            onCreate = { displayName, email, phoneNumber ->
                runAction({ ApiClient.createAdministratorCustomer(token, displayName, email, phoneNumber) }) { result ->
                    (result as? NewAdminCustomerResult)?.let { created ->
                        newCustomerCredentials = created
                        showCreateCustomer = false
                        page = 1
                        appliedSearch = ""
                        searchText = ""
                        loadRevision += 1
                    }
                }
            },
        )
    }
    newCustomerCredentials?.let { result ->
        NewCustomerCredentialsDialog(result) { newCustomerCredentials = null }
    }
}

@Composable
private fun CreateCustomerDialog(
    onDismiss: () -> Unit,
    onCreate: (displayName: String, email: String, phoneNumber: String) -> Unit,
) {
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новый клиент") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Клиент получит временный пароль и сменит его при первом входе.", fontSize = 12.sp, color = UtpMuted)
                OutlinedTextField(displayName, { displayName = it.take(120) }, label = { Text("Имя") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                OutlinedTextField(email, { email = it.take(320) }, label = { Text("Электронная почта") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                OutlinedTextField(phoneNumber, { phoneNumber = it.take(32) }, label = { Text("Телефон (необязательно)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onCreate(displayName.trim(), email.trim(), phoneNumber.trim()) },
                enabled = displayName.trim().length >= 2 && email.contains("@"),
            ) { Text("Создать") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
private fun NewCustomerCredentialsDialog(
    result: NewAdminCustomerResult,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Данные для первого входа") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Передайте данные клиенту безопасным способом. После закрытия пароль больше не будет показан.", fontSize = 12.sp, color = UtpMuted)
                Text("Клиент: ${result.customer.displayName}", fontWeight = FontWeight.SemiBold)
                Text("Почта: ${result.customer.email}")
                Text("Временный пароль: ${result.temporaryPassword}", fontWeight = FontWeight.Bold)
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Готово") } },
    )
}

@Composable
private fun EditCustomerDialog(
    customer: AdminCustomer,
    onDismiss: () -> Unit,
    onSave: (AdminCustomer) -> Unit,
) {
    var displayName by remember(customer.id) { mutableStateOf(customer.displayName) }
    var email by remember(customer.id) { mutableStateOf(customer.email) }
    var phoneNumber by remember(customer.id) { mutableStateOf(customer.phoneNumber.orEmpty()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Данные клиента") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it.take(120) },
                    label = { Text("Имя") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it.take(320) },
                    label = { Text("Электронная почта для входа") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it.take(32) },
                    label = { Text("Телефон") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    shape = RoundedCornerShape(12.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(customer.copy(
                        displayName = displayName.trim(),
                        email = email.trim(),
                        phoneNumber = phoneNumber.trim().takeIf { it.isNotEmpty() },
                    ))
                },
                enabled = displayName.trim().length >= 2 && email.contains("@"),
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
