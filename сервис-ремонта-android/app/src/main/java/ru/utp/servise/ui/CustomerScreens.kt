package ru.utp.servise.ui

import android.app.Activity
import androidx.compose.foundation.Image
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.AuthResult
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.roleLabel

private val deviceTypes = listOf("COMPUTER", "LAPTOP", "PHONE", "TABLET")

@Composable
fun CustomerHomeScreen(
    user: AppUser,
    token: String,
    news: List<NewsArticle>,
    banners: List<SiteBanner>,
    onCreateRequest: () -> Unit,
    onOrders: () -> Unit,
    onCrafts: () -> Unit,
    onAbout: () -> Unit,
    onNews: () -> Unit,
    onLoyalty: () -> Unit,
    onCampaignNavigate: (String) -> Unit,
    onContactAdministrator: () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Image(painterResource(R.drawable.utp_servise_logo), "Логотип UTP Servise", Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)))
            Column(Modifier.weight(1f).padding(start = 11.dp)) {
                Text("UTP Servise", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Сервисный центр", fontSize = 12.sp, color = UtpMuted)
            }
            Text("Привет, ${user.displayName.substringBefore(' ')}", color = UtpBlue, fontSize = 12.sp)
        }
        Spacer(Modifier.height(18.dp))
            Card(shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = UtpMint)) {
            Column(Modifier.fillMaxWidth().padding(20.dp)) {
                Text("Ремонт компьютеров и гаджетов", fontSize = 23.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Опишите неисправность — мастер свяжется с вами и согласует стоимость.", fontSize = 13.sp, lineHeight = 19.sp, color = UtpMuted, modifier = Modifier.padding(top = 8.dp))
                Button(onClick = onCreateRequest, modifier = Modifier.padding(top = 14.dp), shape = RoundedCornerShape(18.dp)) { Text("Оставить заявку  →") }
            }
        }
        Spacer(Modifier.height(23.dp))
        banners.filter { it.placements.contains("HOME") }.forEach { banner ->
            CampaignBannerCard(banner, token, onCampaignNavigate)
        }
        Card(onClick = onLoyalty, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("★", fontSize = 24.sp, color = UtpBlue)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("Бонусы и история", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("10% после оплаты, списание до 30% чека", fontSize = 12.sp, color = UtpMuted)
                }
                Text("›", fontSize = 24.sp, color = UtpMuted)
            }
        }
        Spacer(Modifier.height(10.dp))
        Text("Что нужно отремонтировать?", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            deviceTypes.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    row.forEach { device ->
                        Card(onClick = onCreateRequest, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                            Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(device.icon(), fontSize = 24.sp, color = UtpBlue)
                                Text(device.deviceLabel(), color = UtpInk, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 10.dp))
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(22.dp))
        Card(onClick = onOrders, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("◷", fontSize = 24.sp, color = UtpBlue)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("История и статус заказа", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Все обращения — в одном месте", fontSize = 12.sp, color = UtpMuted)
                }
                Text("›", fontSize = 24.sp, color = UtpMuted)
            }
        }
        Spacer(Modifier.height(10.dp))
        Card(onClick = onContactAdministrator, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("✉", fontSize = 24.sp, color = UtpBlue)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("Написать администратору", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Задать вопрос напрямую в чат", fontSize = 12.sp, color = UtpMuted)
                }
                Text("›", fontSize = 24.sp, color = UtpMuted)
            }
        }
        Spacer(Modifier.height(10.dp))
        Card(onClick = onCrafts, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("✿", fontSize = 24.sp, color = UtpBlue)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("Рукоделия", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Готовые изделия и заказные работы", fontSize = 12.sp, color = UtpMuted)
                }
                Text("›", fontSize = 24.sp, color = UtpMuted)
            }
        }
        Spacer(Modifier.height(10.dp))
        Card(onClick = onAbout, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("ℹ", fontSize = 24.sp, color = UtpBlue)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("О компании", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Услуги, контакты и история сервиса", fontSize = 12.sp, color = UtpMuted)
                }
                Text("›", fontSize = 24.sp, color = UtpMuted)
            }
        }
        val featuredNews = news.filter { it.isFeatured }
        if (featuredNews.isNotEmpty()) {
            Spacer(Modifier.height(24.dp))
            Text("В центре внимания", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Spacer(Modifier.height(10.dp))
            featuredNews.take(2).forEach { article -> CustomerNewsCard(article, token) }
        }
        Spacer(Modifier.height(24.dp))
        Text("Новости сервиса", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        TextButton(onClick = onNews) { Text("Все новости и отзывы →") }
        Spacer(Modifier.height(10.dp))
        if (news.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text("Пока нет новостей. Загляните сюда позже.", Modifier.padding(16.dp), color = UtpMuted, fontSize = 13.sp)
            }
        }
        news.filterNot { it.isFeatured }.take(5).forEach { article -> CustomerNewsCard(article, token) }
    }
}

@Composable
fun ProfileScreen(
    user: AppUser,
    token: String,
    runAction: RunAction,
    onUserUpdated: (AppUser) -> Unit,
    onPasswordChanged: (AuthResult) -> Unit,
    onLogout: () -> Unit,
) {
    val context = LocalContext.current
    var phoneNumber by remember(user.id) { mutableStateOf(user.phoneNumber.orEmpty()) }
    var savedPhone by remember(user.id) { mutableStateOf(user.phoneNumber.orEmpty()) }
    var themeMode by remember(user.id) { mutableStateOf(readThemeMode(context)) }
    var currentPassword by remember(user.id) { mutableStateOf("") }
    var newPassword by remember(user.id) { mutableStateOf("") }
    var confirmPassword by remember(user.id) { mutableStateOf("") }
    var passwordError by remember(user.id) { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp)) {
        Text("Профиль", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(15.dp))
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RemoteProjectImage(
                        user.avatarObjectId,
                        token,
                        Modifier.size(62.dp).clip(RoundedCornerShape(31.dp)),
                        "Аватар ${user.displayName}",
                    )
                    Column(Modifier.padding(start = 12.dp)) {
                        Text(user.displayName, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = UtpInk)
                        Text(user.email, fontSize = 13.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
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
                Button(
                    onClick = {
                        val normalized = phoneNumber.trim().takeIf { it.isNotEmpty() }
                        runAction({ ru.utp.servise.data.ApiClient.updatePhoneNumber(token, normalized) }) { result ->
                            val updatedUser = result as? AppUser
                            updatedUser?.let(onUserUpdated)
                            val updatedPhone = updatedUser?.phoneNumber.orEmpty()
                            phoneNumber = updatedPhone
                            savedPhone = updatedPhone
                        }
                    },
                    enabled = phoneNumber.trim() != savedPhone,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    shape = RoundedCornerShape(18.dp),
                ) { Text("Сохранить телефон") }
                Text("UTP Servise · защищённый вход по электронной почте", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 11.dp))
            }
        }
        Spacer(Modifier.height(12.dp))
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Смена пароля", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Новый пароль — не менее 12 символов. После смены остальные сеансы будут завершены.", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp, bottom = 10.dp))
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
                    label = { Text("Новый пароль (от 12 символов)") },
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
                            newPassword.length < 12 -> "Новый пароль должен содержать не менее 12 символов."
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
                Text("Внешний вид", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Выберите оформление приложения", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
                ThemeMode.entries.forEach { mode ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                themeMode = mode
                                saveThemeMode(context, mode)
                                (context as? Activity)?.recreate()
                            },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = themeMode == mode,
                            onClick = {
                                themeMode = mode
                                saveThemeMode(context, mode)
                                (context as? Activity)?.recreate()
                            },
                        )
                        Text(mode.title, color = UtpInk, fontSize = 14.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) { Text("Выйти из аккаунта") }
    }
}

private fun String.icon(): String = when (this) {
    "COMPUTER" -> "▣"
    "LAPTOP" -> "▰"
    "PHONE" -> "▯"
    else -> "▤"
}
