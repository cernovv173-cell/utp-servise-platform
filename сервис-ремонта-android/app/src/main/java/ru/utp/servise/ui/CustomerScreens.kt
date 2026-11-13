package ru.utp.servise.ui

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.AuthResult
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.clearShopCart
import ru.utp.servise.data.roleLabel
import java.time.LocalDate

@Composable
fun ProfileScreen(
    user: AppUser,
    token: String,
    runAction: RunAction,
    onUserUpdated: (AppUser) -> Unit,
    onPasswordChanged: (AuthResult) -> Unit,
    onLogout: () -> Unit,
    onAccountDeleted: (() -> Unit)? = null,
    onOpenSections: (() -> Unit)? = null,
    onOpenVersion: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    var phoneNumber by remember(user.id) { mutableStateOf(user.phoneNumber.orEmpty()) }
    var savedPhone by remember(user.id) { mutableStateOf(user.phoneNumber.orEmpty()) }
    var gender by remember(user.id) { mutableStateOf(user.gender.orEmpty()) }
    var savedGender by remember(user.id) { mutableStateOf(user.gender.orEmpty()) }
    var birthDate by remember(user.id) { mutableStateOf(user.birthDate.orEmpty()) }
    var savedBirthDate by remember(user.id) { mutableStateOf(user.birthDate.orEmpty()) }
    var genderMenuExpanded by remember { mutableStateOf(false) }
    var currentPassword by remember(user.id) { mutableStateOf("") }
    var newPassword by remember(user.id) { mutableStateOf("") }
    var confirmPassword by remember(user.id) { mutableStateOf("") }
    var passwordError by remember(user.id) { mutableStateOf<String?>(null) }
    var telegramLinked by remember(user.id, user.telegramLinked) { mutableStateOf(user.telegramLinked) }
    var telegramLinkUrl by remember(user.id) { mutableStateOf<String?>(null) }
    var maxLinked by remember(user.id, user.maxLinked) { mutableStateOf(user.maxLinked) }
    var maxLinkUrl by remember(user.id) { mutableStateOf<String?>(null) }
    var showAccountDeletionDialog by remember(user.id) { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp)) {
        Text("Профиль", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(15.dp))
        onOpenSections?.let { openSections ->
            OutlinedButton(
                onClick = openSections,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text("Все разделы аккаунта")
            }
        }
        onOpenVersion?.let { openVersion ->
            OutlinedButton(
                onClick = openVersion,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Text("О версии программы")
                    Text("Версия приложения и номер сборки", fontSize = 12.sp, color = UtpMuted)
                }
            }
        }
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    UserAvatar(
                        user.avatarObjectId,
                        token,
                        Modifier.size(62.dp).clip(RoundedCornerShape(31.dp)),
                        "Аватар ${user.displayName}",
                    )
                    Column(Modifier.padding(start = 12.dp)) {
                        Text(user.displayName, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = UtpInk)
                        Text(
                            user.email ?: "Почта не привязана — вход через МАКС",
                            fontSize = 13.sp,
                            color = UtpMuted,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                Text(user.role.roleLabel(), fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 9.dp))
                PhotoPickerButton(
                    label = if (user.avatarObjectId == null) "Добавить аватар" else "Изменить аватар",
                ) { uri ->
                    runAction({
                        ru.utp.servise.data.ApiClient.updateAvatar(
                            token,
                            compressSelectedImage(context, uri),
                        )
                    }) { result ->
                        (result as? AppUser)?.let(onUserUpdated)
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        AndroidAppUpdateNotice()
        Spacer(Modifier.height(12.dp))
        if (user.role == "CUSTOMER" && user.maxLinked && user.email == null) {
            MaxEmailLoginCard(
                token = token,
                runAction = runAction,
                onUserUpdated = onUserUpdated,
            )
        }
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Контактный телефон", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Номер увидят только администратор и участники ремонта по вашей заявке.", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp, bottom = 10.dp))
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it },
                    label = { Text("Номер телефона") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    shape = RoundedCornerShape(16.dp),
                )
                if (user.role == "CUSTOMER") {
                    Text(
                        "Дополнительные данные (необязательно)",
                        fontWeight = FontWeight.SemiBold,
                        color = UtpInk,
                        modifier = Modifier.padding(top = 14.dp),
                    )
                    Box {
                        OutlinedButton(
                            onClick = { genderMenuExpanded = true },
                            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Text(
                                "Пол: ${when (gender) { "MALE" -> "мужской"; "FEMALE" -> "женский"; else -> "не указан" }}",
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        DropdownMenu(
                            expanded = genderMenuExpanded,
                            onDismissRequest = { genderMenuExpanded = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Не указывать") },
                                onClick = { gender = ""; genderMenuExpanded = false },
                            )
                            DropdownMenuItem(
                                text = { Text("Женский") },
                                onClick = { gender = "FEMALE"; genderMenuExpanded = false },
                            )
                            DropdownMenuItem(
                                text = { Text("Мужской") },
                                onClick = { gender = "MALE"; genderMenuExpanded = false },
                            )
                        }
                    }
                    val parsedBirthDate = runCatching { LocalDate.parse(birthDate) }.getOrNull()
                    OutlinedButton(
                        onClick = {
                            val initial = parsedBirthDate ?: LocalDate.now()
                            DatePickerDialog(
                                context,
                                { _, year, month, day ->
                                    birthDate = "%04d-%02d-%02d".format(year, month + 1, day)
                                },
                                initial.year,
                                initial.monthValue - 1,
                                initial.dayOfMonth,
                            ).apply { datePicker.maxDate = System.currentTimeMillis() }.show()
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Text(
                            "Дата рождения: ${parsedBirthDate?.let { "%02d.%02d.%04d".format(it.dayOfMonth, it.monthValue, it.year) } ?: "не указана"}",
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (birthDate.isNotBlank()) {
                        TextButton(onClick = { birthDate = "" }) {
                            Text("Очистить дату рождения")
                        }
                    }
                    Text(
                        "При разрешённых push-уведомлениях сервис пришлёт поздравление в день рождения.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
                Button(
                    onClick = {
                        val normalized = phoneNumber.trim().takeIf { it.isNotEmpty() }
                        val customerProfile = user.role == "CUSTOMER"
                        runAction({
                            ru.utp.servise.data.ApiClient.updateProfile(
                                token,
                                normalized,
                                if (customerProfile) gender.takeIf { it.isNotBlank() } else null,
                                if (customerProfile) birthDate.takeIf { it.isNotBlank() } else null,
                            )
                        }) { result ->
                            val updatedUser = result as? AppUser
                            updatedUser?.let(onUserUpdated)
                            val updatedPhone = updatedUser?.phoneNumber.orEmpty()
                            phoneNumber = updatedPhone
                            savedPhone = updatedPhone
                            gender = updatedUser?.gender.orEmpty()
                            savedGender = gender
                            birthDate = updatedUser?.birthDate.orEmpty()
                            savedBirthDate = birthDate
                        }
                    },
                    enabled = phoneNumber.trim() != savedPhone ||
                        (user.role == "CUSTOMER" && (gender != savedGender || birthDate != savedBirthDate)),
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    shape = RoundedCornerShape(18.dp),
                ) { Text("Сохранить телефон") }
                Text("ЕНОТ СЕРВИС · защищённый вход по электронной почте", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 11.dp))
            }
        }
        if (user.role == "CUSTOMER") {
            Spacer(Modifier.height(12.dp))
            MessengerNotificationCard(
                serviceName = "Telegram",
                connected = telegramLinked,
                linkUrl = telegramLinkUrl,
                onConnect = {
                    runAction({ ru.utp.servise.data.ApiClient.requestTelegramLink(token) }) { result ->
                        telegramLinkUrl = result as? String
                    }
                },
                onCheckConnection = {
                    runAction({ ru.utp.servise.data.ApiClient.isTelegramConnected(token) }) { result ->
                        telegramLinked = result as? Boolean == true
                        if (telegramLinked) {
                            telegramLinkUrl = null
                            onUserUpdated(user.copy(telegramLinked = true))
                        }
                    }
                },
                onDisconnect = {
                    runAction({ ru.utp.servise.data.ApiClient.disconnectTelegram(token) }) {
                        telegramLinked = false
                        telegramLinkUrl = null
                        onUserUpdated(user.copy(telegramLinked = false))
                    }
                },
            )
        }
        Spacer(Modifier.height(10.dp))
        MessengerNotificationCard(
            serviceName = "MAX",
            available = user.maxAvailable,
            connected = maxLinked,
            linkUrl = maxLinkUrl,
            onConnect = {
                runAction({ ru.utp.servise.data.ApiClient.requestMaxLink(token) }) { result ->
                    maxLinkUrl = result as? String
                }
            },
            onCheckConnection = {
                runAction({ ru.utp.servise.data.ApiClient.isMaxConnected(token) }) { result ->
                    maxLinked = result as? Boolean == true
                    if (maxLinked) {
                        maxLinkUrl = null
                        onUserUpdated(user.copy(maxLinked = true))
                    }
                }
            },
            onDisconnect = {
                runAction({ ru.utp.servise.data.ApiClient.disconnectMax(token) }) {
                    maxLinked = false
                    maxLinkUrl = null
                    onUserUpdated(user.copy(maxLinked = false))
                }
            },
        )
        Spacer(Modifier.height(12.dp))
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Смена пароля", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Новый пароль — не менее 8 символов. После смены остальные сеансы будут завершены.", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp, bottom = 10.dp))
                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it.take(128) },
                    label = { Text("Текущий пароль") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(16.dp),
                )
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it.take(128) },
                    label = { Text("Новый пароль (от 8 символов)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(16.dp),
                )
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it.take(128) },
                    label = { Text("Повторите новый пароль") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(16.dp),
                )
                passwordError?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
                Button(
                    onClick = {
                        val validationError = when {
                            newPassword.length < 8 -> "Новый пароль должен содержать не менее 8 символов."
                            newPassword != confirmPassword -> "Новые пароли не совпадают."
                            else -> null
                        }
                        passwordError = validationError
                        if (validationError == null) {
                            runAction({ ru.utp.servise.data.ApiClient.changePassword(token, currentPassword, newPassword) }) { result ->
                                (result as? AuthResult)?.let { auth ->
                                    currentPassword = ""
                                    newPassword = ""
                                    confirmPassword = ""
                                    passwordError = null
                                    onPasswordChanged(auth)
                                }
                            }
                        }
                    },
                    enabled = currentPassword.isNotEmpty() && newPassword.isNotEmpty() && confirmPassword.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    shape = RoundedCornerShape(18.dp),
                ) { Text("Сменить пароль") }
            }
        }
        Spacer(Modifier.height(12.dp))
        Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Тёмная тема", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Всегда включена", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
            }
        }
        if (user.role == "CUSTOMER" && onAccountDeleted != null) {
            Spacer(Modifier.height(12.dp))
            Card(
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Text("Удаление аккаунта", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(
                        "Удалить аккаунт и связанные с ним данные можно здесь, в приложении.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 5.dp, bottom = 4.dp),
                    )
                    TextButton(onClick = { showAccountDeletionDialog = true }) {
                        Text("Удалить аккаунт", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) { Text("Выйти из аккаунта") }
        PrivacyPolicyLink(modifier = Modifier.fillMaxWidth())
    }

    if (showAccountDeletionDialog) {
        AlertDialog(
            onDismissRequest = { showAccountDeletionDialog = false },
            title = { Text("Удалить аккаунт безвозвратно?") },
            text = {
                Text(
                    "Будут удалены аккаунт, заявки и история ремонтов, заказы магазина и изделий, " +
                        "переписки, отзывы, фотографии и бонусные данные. Незавершённые " +
                        "заявки тоже будут удалены. Восстановить данные после удаления нельзя.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showAccountDeletionDialog = false
                        runAction({ ru.utp.servise.data.ApiClient.deleteOwnAccount(token) }) {
                            clearShopCart(context, user.id)
                            onAccountDeleted?.invoke()
                        }
                    },
                ) {
                    Text("Удалить навсегда", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAccountDeletionDialog = false }) {
                    Text("Отмена")
                }
            },
        )
    }
}
