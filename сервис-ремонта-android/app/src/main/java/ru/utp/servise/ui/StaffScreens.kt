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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.AuthResult
import ru.utp.servise.data.NewStaffResult
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.ApiClient

private data class StaffPermissionChoice(
    val key: String,
    val label: String,
    val description: String,
)

private val staffPermissionChoices = listOf(
    StaffPermissionChoice("repairs", "Заявки и ремонт", "Назначенные заявки и собственные начисления."),
    StaffPermissionChoice("inventory", "Каталог и склад", "Каталог товаров, остатки, поставщики и поступления."),
    StaffPermissionChoice("customers", "Клиенты", "Поиск и работа с клиентскими данными."),
    StaffPermissionChoice("shop_orders", "Заказы магазина", "Обработка заказов товаров и доставки."),
    StaffPermissionChoice("communications", "Чаты и поддержка", "Переписка по заявкам и обращения клиентов."),
    StaffPermissionChoice("content", "Новости и предложения", "Новости, баннеры, акции и розыгрыши."),
    StaffPermissionChoice("reports", "Расписание и отчёты", "Просмотр расписания и рабочих отчётов."),
    StaffPermissionChoice("company_settings", "Настройки сервиса", "Контакты и сезонное оформление."),
    StaffPermissionChoice("staff_management", "Сотрудники и доступы", "Создание сотрудников и настройка их прав."),
)

@Composable
fun StaffManagementScreen(
    token: String,
    currentUser: AppUser,
    staff: List<StaffMember>,
    runAction: RunAction,
    refresh: () -> Unit,
    onOpenTechnicianProfile: (String) -> Unit = {},
) {
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var selectedPermissions by remember { mutableStateOf(setOf<String>()) }
    var fullAdministrator by remember { mutableStateOf(false) }
    var temporaryPassword by remember { mutableStateOf<String?>(null) }
    var editedStaff by remember { mutableStateOf<StaffMember?>(null) }
    var deletingStaff by remember { mutableStateOf<StaffMember?>(null) }
    val isFullAdministrator = currentUser.role == "ADMIN" && !currentUser.isAdminAssistant
    val availablePermissionChoices = staffPermissionChoices.filter {
        isFullAdministrator || it.key in currentUser.permissions
    }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Сотрудники", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Управляйте учётными записями и доступом команды", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        Spacer(Modifier.height(13.dp))
        Card(shape = RoundedCornerShape(17.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(15.dp)) {
                Text("Добавить сотрудника", fontWeight = FontWeight.SemiBold, color = UtpInk)
                OutlinedTextField(displayName, { displayName = it }, label = { Text("Имя") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(email, { email = it }, label = { Text("Рабочая почта") }, modifier = Modifier.fillMaxWidth().padding(top = 7.dp), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it },
                    label = { Text("Телефон сотрудника (необязательно)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 7.dp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    shape = RoundedCornerShape(16.dp),
                )
                if (isFullAdministrator) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                        Checkbox(checked = fullAdministrator, onCheckedChange = { fullAdministrator = it })
                        Column {
                            Text("Полный доступ администратора", fontWeight = FontWeight.Medium)
                            Text("Отдельный защищённый уровень доступа ко всем разделам.", fontSize = 11.sp, color = UtpMuted)
                        }
                    }
                }
                if (!fullAdministrator) {
                    Text("Доступ к разделам", fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 8.dp))
                    staffPermissionChoices.forEach { choice ->
                        val canAssign = choice in availablePermissionChoices
                        Row(
                            verticalAlignment = Alignment.Top,
                            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
                        ) {
                            Checkbox(
                                checked = choice.key in selectedPermissions,
                                enabled = canAssign,
                                onCheckedChange = { checked ->
                                    selectedPermissions = if (checked) {
                                        selectedPermissions + choice.key
                                    } else {
                                        selectedPermissions - choice.key
                                    }
                                },
                            )
                            Column(Modifier.padding(top = 10.dp)) {
                                Text(choice.label, fontWeight = FontWeight.Medium)
                                Text(choice.description, fontSize = 11.sp, lineHeight = 15.sp, color = UtpMuted)
                            }
                        }
                    }
                }
                Text("Должность отдельно не назначается. Права можно сохранить и изменить позднее.", fontSize = 11.sp, lineHeight = 16.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp))
                Button(
                    onClick = {
                        runAction({ ru.utp.servise.data.ApiClient.createStaff(token, email.trim(), displayName.trim(), selectedPermissions.toList(), fullAdministrator, phoneNumber.trim().takeIf { it.isNotEmpty() }) }) { result ->
                            val created = result as? NewStaffResult
                            temporaryPassword = created?.let {
                                "Логин: ${it.staff.login ?: it.staff.email}\nРабочая почта: ${it.staff.email}\n\nВременный пароль: ${it.temporaryPassword}"
                            }
                            email = ""
                            displayName = ""
                            phoneNumber = ""
                            selectedPermissions = emptySet()
                            fullAdministrator = false
                        }
                    },
                    enabled = displayName.trim().length >= 2 && email.contains("@"),
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Создать сотрудника") }
            }
        }
        Spacer(Modifier.height(14.dp))
        Text("Учётные записи (${staff.size})", fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.padding(bottom = 8.dp))
        staff.forEach { member ->
            val isFullAdmin = member.role == "ADMIN" && !member.isAdminAssistant
            val memberPermissionLabels = staffPermissionChoices
                .filter { it.key in member.permissions }
                .joinToString { it.label }
            Card(Modifier.fillMaxWidth().padding(bottom = 8.dp), shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                    UserAvatar(
                        objectId = member.avatarObjectId,
                        token = token,
                        modifier = Modifier.size(44.dp).clip(RoundedCornerShape(22.dp)),
                        contentDescription = "Аватар ${member.displayName}",
                    )
                    Column(Modifier.weight(1f)) {
                        Text(member.displayName, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(member.email, fontSize = 12.sp, color = UtpMuted)
                        member.phoneNumber?.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 2.dp)) }
                        Text(
                            "${if (isFullAdmin) "Полный доступ администратора" else "Сотрудник"} · ${member.terminatedAt?.let { "Уволен навсегда" } ?: if (member.active) "Активен" else "Доступ отключён"}",
                            fontSize = 11.sp,
                            color = if (member.active && member.terminatedAt == null) UtpGreen else UtpMuted,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        Text(
                            "Доступ: ${if (isFullAdmin) "все разделы" else memberPermissionLabels.ifBlank { "не назначен" }}",
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            color = UtpMuted,
                            modifier = Modifier.padding(top = 3.dp),
                        )
                        if ("repairs" in member.permissions || member.role == "TECHNICIAN") {
                            Text(
                                "Оплата: ${member.salaryRatePercent}% только от услуг",
                                fontSize = 11.sp,
                                color = UtpMuted,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        if ("repairs" in member.permissions || member.role == "TECHNICIAN") {
                            TextButton(onClick = { onOpenTechnicianProfile(member.id) }) { Text("Профиль") }
                        }
                        if (
                            member.id != currentUser.id &&
                            !(member.role == "ADMIN" && !member.isAdminAssistant)
                        ) TextButton(onClick = { editedStaff = member }) { Text("Изменить права") }
                        if (member.id != currentUser.id && member.terminatedAt == null) {
                            TextButton(
                                onClick = {
                                    runAction(
                                        { ApiClient.setStaffActive(token, member.id, !member.active) },
                                        { refresh() },
                                    )
                                },
                            ) { Text(if (member.active) "Отключить" else "Включить") }
                            TextButton(onClick = { deletingStaff = member }) {
                                Text("Уволить навсегда")
                            }
                        }
                    }
                }
            }
        }
    }
    temporaryPassword?.let { credentials ->
        AlertDialog(
            onDismissRequest = { temporaryPassword = null },
            title = { Text("Сотрудник создан") },
            text = { Text("Передайте эти данные сотруднику. Временный пароль отображается только сейчас.\n\n$credentials") },
            confirmButton = { TextButton(onClick = { temporaryPassword = null; refresh() }) { Text("Скопировал") } },
        )
    }
    editedStaff?.let { member ->
        EditStaffDialog(
            staff = member,
            permissionChoices = availablePermissionChoices,
            onDismiss = { editedStaff = null },
            onSave = { updated ->
                runAction({ ApiClient.updateStaff(token, updated) }) {
                    editedStaff = null
                    refresh()
                }
            },
        )
    }
    deletingStaff?.let { member ->
        AlertDialog(
            onDismissRequest = { deletingStaff = null },
            title = { Text("Уволить сотрудника навсегда?") },
            text = {
                Text("Вход для ${member.displayName} и связанные сеансы будут закрыты навсегда. История, завершённые заявки, чеки и начисления сохранятся; незавершённые заявки вернутся администраторам для переназначения. Восстановить доступ нельзя.")
            },
            confirmButton = {
                TextButton(onClick = {
                    runAction({ ApiClient.terminateStaff(token, member.id) }) {
                        deletingStaff = null
                        refresh()
                    }
                }) { Text("Уволить навсегда") }
            },
            dismissButton = { TextButton(onClick = { deletingStaff = null }) { Text("Отмена") } },
        )
    }
}

@Composable
private fun EditStaffDialog(
    staff: StaffMember,
    permissionChoices: List<StaffPermissionChoice>,
    onDismiss: () -> Unit,
    onSave: (StaffMember) -> Unit,
) {
    var displayName by remember(staff.id) { mutableStateOf(staff.displayName) }
    var phoneNumber by remember(staff.id) { mutableStateOf(staff.phoneNumber.orEmpty()) }
    var salaryRatePercent by remember(staff.id) { mutableStateOf(staff.salaryRatePercent.toString()) }
    var permissions by remember(staff.id) { mutableStateOf(staff.permissions.toSet()) }
    var validationError by remember(staff.id) { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Редактировать сотрудника") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it.take(120) },
                    label = { Text("Имя") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it.take(32) },
                    label = { Text("Телефон") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                Text("Доступ к разделам", fontWeight = FontWeight.Medium)
                permissionChoices.forEach { choice ->
                    Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                        Checkbox(
                            checked = choice.key in permissions,
                            onCheckedChange = { checked ->
                                permissions = if (checked) permissions + choice.key else permissions - choice.key
                            },
                        )
                        Column(Modifier.padding(top = 10.dp)) {
                            Text(choice.label, fontWeight = FontWeight.Medium)
                            Text(choice.description, fontSize = 11.sp, lineHeight = 15.sp, color = UtpMuted)
                        }
                    }
                }
                if ("repairs" in permissions) {
                OutlinedTextField(
                    value = salaryRatePercent,
                    onValueChange = { value ->
                        if (value.all(Char::isDigit) && value.length <= 3) {
                            salaryRatePercent = value
                            validationError = null
                        }
                    },
                    label = { Text("Процент оплаты за услуги") },
                    suffix = { Text("%") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    isError = validationError != null,
                )
                Text(
                    "Ставка применяется к новым начислениям. Запчасти и товары не учитываются.",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = UtpMuted,
                )
                }
                validationError?.let { error ->
                    Text(
                        error,
                        color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val rate = salaryRatePercent.toIntOrNull()
                    if (rate == null || rate !in 0..100) {
                        validationError = "Укажите целое число от 0 до 100."
                        return@TextButton
                    }
                    onSave(
                        staff.copy(
                            displayName = displayName.trim(),
                            phoneNumber = phoneNumber.trim().takeIf { it.isNotEmpty() },
                            permissions = permissions.toList(),
                            salaryRatePercent = rate,
                        ),
                    )
                },
                enabled = displayName.trim().length >= 2,
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
fun ChangeTemporaryPasswordScreen(onChange: (String, String, (AuthResult) -> Unit) -> Unit, busy: Boolean) {
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(22.dp)) {
        Text("Смените временный пароль", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("До смены пароля доступ к заказам и сотрудникам закрыт.", color = UtpMuted, modifier = Modifier.padding(top = 6.dp, bottom = 15.dp))
        OutlinedTextField(current, { current = it }, label = { Text("Временный пароль") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(12.dp))
        OutlinedTextField(next, { next = it }, label = { Text("Новый пароль — от 8 символов") }, modifier = Modifier.fillMaxWidth().padding(top = 9.dp), singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(12.dp))
        OutlinedTextField(confirm, { confirm = it }, label = { Text("Повторите новый пароль") }, modifier = Modifier.fillMaxWidth().padding(top = 9.dp), singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(12.dp))
        localError?.let { Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
        Button(
            onClick = {
                if (next.length < 8) localError = "Новый пароль должен содержать не менее 8 символов."
                else if (next != confirm) localError = "Пароли не совпадают."
                else {
                    localError = null
                    onChange(current, next) { current = ""; next = ""; confirm = "" }
                }
            },
            enabled = !busy && current.isNotEmpty() && next.isNotEmpty() && confirm.isNotEmpty(),
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(50.dp),
            shape = RoundedCornerShape(13.dp),
        ) { Text(if (busy) "Сохранение…" else "Сменить пароль") }
    }
}
