package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.roleLabel

private val deviceTypes = listOf("COMPUTER", "LAPTOP", "PHONE", "TABLET")

@Composable
fun CustomerHomeScreen(user: AppUser, news: List<NewsArticle>, onCreateRequest: () -> Unit, onOrders: () -> Unit) {
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
        Text("Что нужно отремонтировать?", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            deviceTypes.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    row.forEach { device ->
                        Card(onClick = onCreateRequest, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
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
        Card(onClick = onOrders, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("◷", fontSize = 24.sp, color = UtpBlue)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("История и статус заказа", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("Все обращения — в одном месте", fontSize = 12.sp, color = UtpMuted)
                }
                Text("›", fontSize = 24.sp, color = UtpMuted)
            }
        }
        Spacer(Modifier.height(24.dp))
        Text("Новости сервиса", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(10.dp))
        if (news.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
                Text("Пока нет новостей. Загляните сюда позже.", Modifier.padding(16.dp), color = UtpMuted, fontSize = 13.sp)
            }
        }
        news.take(5).forEach { article ->
            Card(
                Modifier.fillMaxWidth().padding(bottom = 9.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White),
            ) {
                Column(Modifier.padding(15.dp)) {
                    Text(article.title, fontWeight = FontWeight.SemiBold, color = UtpInk, fontSize = 15.sp)
                    Text(article.content, color = UtpMuted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
    }
}

@Composable
fun RepairRequestForm(onBack: () -> Unit, onSubmit: (String, String, String) -> Unit, busy: Boolean) {
    var device by remember { mutableStateOf(deviceTypes.first()) }
    var deviceMenu by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Новая заявка", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Сотрудники сервиса увидят детали и свяжутся с вами.", fontSize = 13.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp, bottom = 16.dp))
        Box {
            OutlinedButton(onClick = { deviceMenu = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                Text("Устройство: ${device.deviceLabel()}", modifier = Modifier.weight(1f))
                Text("⌄")
            }
            DropdownMenu(expanded = deviceMenu, onDismissRequest = { deviceMenu = false }) {
                deviceTypes.forEach { item -> DropdownMenuItem(text = { Text(item.deviceLabel()) }, onClick = { device = item; deviceMenu = false }) }
            }
        }
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(problem, { problem = it }, label = { Text("Опишите неисправность") }, placeholder = { Text("Например: ноутбук не включается") }, modifier = Modifier.fillMaxWidth().height(128.dp), shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(address, { address = it }, label = { Text("Адрес") }, placeholder = { Text("Город, улица, дом") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(14.dp))
        Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
            Text("Цена согласуется с вами. Оплата наличными или картой — после завершения ремонта.", Modifier.padding(14.dp), color = UtpInk, fontSize = 13.sp, lineHeight = 19.sp)
        }
        Spacer(Modifier.height(18.dp))
        Button(
            onClick = { onSubmit(device, problem.trim(), address.trim()) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = !busy && problem.trim().length >= 5 && address.trim().length >= 8,
            shape = RoundedCornerShape(15.dp),
        ) { Text(if (busy) "Отправка…" else "Отправить заявку") }
    }
}

@Composable
fun ProfileScreen(user: AppUser, token: String, runAction: RunAction, onLogout: () -> Unit) {
    var phoneNumber by remember(user.id) { mutableStateOf(user.phoneNumber.orEmpty()) }
    var savedPhone by remember(user.id) { mutableStateOf(user.phoneNumber.orEmpty()) }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp)) {
        Text("Профиль", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(15.dp))
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text(user.displayName, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = UtpInk)
                Text(user.email, fontSize = 13.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
                Text(user.role.roleLabel(), fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 9.dp))
            }
        }
        Spacer(Modifier.height(12.dp))
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
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
                            val updated = (result as? AppUser)?.phoneNumber.orEmpty()
                            phoneNumber = updated
                            savedPhone = updated
                        }
                    },
                    enabled = phoneNumber.trim() != savedPhone,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    shape = RoundedCornerShape(18.dp),
                ) { Text("Сохранить телефон") }
                Text("UTP Servise · защищённый вход по электронной почте", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 11.dp))
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
