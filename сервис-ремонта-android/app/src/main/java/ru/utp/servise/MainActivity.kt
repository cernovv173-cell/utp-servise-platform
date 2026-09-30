package ru.utp.servise

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Blue = Color(0xFF2478F2)
private val Ink = Color(0xFF17253A)
private val Muted = Color(0xFF738197)
private val Pale = Color(0xFFF3F7FC)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { UtpServiseApp() }
    }
}

private data class RepairRequest(val device: String, val problem: String, val status: String)

@Composable
private fun UtpServiseApp() {
    var tab by remember { mutableStateOf("Главная") }
    var showRequestForm by remember { mutableStateOf(false) }
    val requests = remember {
        mutableStateListOf(RepairRequest("Стиральная машина", "Не сливает воду", "Мастер назначен"))
    }

    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme.copy(primary = Blue, background = Pale, surface = Color.White)
    ) {
        Surface(modifier = Modifier.fillMaxSize(), color = Pale) {
            Column(modifier = Modifier.fillMaxSize()) {
                Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                    if (showRequestForm) {
                        RequestForm(
                            onBack = { showRequestForm = false },
                            onSubmit = { device, problem ->
                                requests.add(0, RepairRequest(device, problem, "Ожидает подтверждения"))
                                showRequestForm = false
                                tab = "Заявки"
                            }
                        )
                    } else when (tab) {
                        "Заявки" -> RequestsScreen(requests)
                        "Чат" -> ChatScreen()
                        "Профиль" -> ProfileScreen()
                        else -> HomeScreen(onCreateRequest = { showRequestForm = true }, onShowRequests = { tab = "Заявки" })
                    }
                }
                BottomBar(selected = tab, onSelect = { tab = it; showRequestForm = false })
            }
        }
    }
}

@Composable
private fun HomeScreen(onCreateRequest: () -> Unit, onShowRequests: () -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Logo(46)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("UTP Servise", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text("Сервисный центр · Москва", fontSize = 12.sp, color = Muted)
            }
            Text("⌕", fontSize = 28.sp, color = Ink)
        }
        Spacer(Modifier.height(20.dp))
        Card(shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFE4EEFC))) {
            Column(Modifier.fillMaxWidth().padding(21.dp)) {
                Text("Ремонт техники\nбез лишних хлопот", fontSize = 25.sp, lineHeight = 31.sp, fontWeight = FontWeight.Bold, color = Ink)
                Spacer(Modifier.height(8.dp))
                Text("Опишите проблему — мы подберём мастера и согласуем цену до начала работ.", fontSize = 14.sp, lineHeight = 21.sp, color = Color(0xFF55657B))
                Spacer(Modifier.height(16.dp))
                Button(onClick = onCreateRequest, shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Blue)) {
                    Text("Оставить заявку  →", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 4.dp))
                }
                Spacer(Modifier.height(8.dp))
                Text("Бытовая техника • Выезд мастера • Оплата после ремонта", fontSize = 11.sp, color = Muted)
            }
        }
        Spacer(Modifier.height(23.dp))
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Что нужно починить?", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.weight(1f))
            TextButton(onClick = onCreateRequest) { Text("Все услуги") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            DeviceCard("▣", "Стиральная\nмашина", Modifier.weight(1f), onCreateRequest)
            DeviceCard("▤", "Холодильник", Modifier.weight(1f), onCreateRequest)
            DeviceCard("◫", "Посудомойка", Modifier.weight(1f), onCreateRequest)
        }
        Spacer(Modifier.height(22.dp))
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Популярные услуги", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.weight(1f))
            TextButton(onClick = onCreateRequest) { Text("Все") }
        }
        ServiceRow("Стиральная машина", "Диагностика и ремонт", "от 1 500 ₽", "▣", onCreateRequest)
        ServiceRow("Холодильник", "Выезд мастера", "от 1 800 ₽", "▤", onCreateRequest)
        Spacer(Modifier.height(14.dp))
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Row(Modifier.fillMaxWidth().clickable(onClick = onShowRequests).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("◷", fontSize = 22.sp, color = Blue)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Следите за ремонтом", fontWeight = FontWeight.SemiBold, color = Ink)
                    Text("Статус и визит мастера — в разделе «Заявки»", fontSize = 12.sp, color = Muted)
                }
                Text("›", fontSize = 24.sp, color = Muted)
            }
        }
        Spacer(Modifier.height(14.dp))
    }
}

@Composable
private fun Logo(size: Int) {
    Image(
        painter = painterResource(R.drawable.utp_servise_logo),
        contentDescription = "Логотип UTP Servise",
        modifier = Modifier.size(size.dp).clip(RoundedCornerShape(14.dp)),
        contentScale = ContentScale.Crop
    )
}

@Composable
private fun DeviceCard(icon: String, name: String, modifier: Modifier, onClick: () -> Unit) {
    Card(modifier = modifier.clickable(onClick = onClick), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.fillMaxWidth().padding(vertical = 15.dp, horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(icon, fontSize = 27.sp, color = Blue)
            Spacer(Modifier.height(7.dp))
            Text(name, fontSize = 11.sp, lineHeight = 15.sp, color = Ink)
        }
    }
}

@Composable
private fun ServiceRow(title: String, subtitle: String, price: String, icon: String, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp).clickable(onClick = onClick), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(13.dp)).background(Pale), contentAlignment = Alignment.Center) { Text(icon, fontSize = 23.sp, color = Blue) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) { Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Ink); Text(subtitle, fontSize = 12.sp, color = Muted) }
            Text(price, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Blue)
        }
    }
}

@Composable
private fun RequestForm(onBack: () -> Unit, onSubmit: (String, String) -> Unit) {
    var device by remember { mutableStateOf("") }
    var problem by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    Column(Modifier.padding(20.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Новая заявка", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text("Расскажите о проблеме — менеджер уточнит детали и согласует цену.", color = Muted, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp, bottom = 16.dp))
        OutlinedTextField(device, { device = it }, label = { Text("Тип техники") }, placeholder = { Text("Например, стиральная машина") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), singleLine = true)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(problem, { problem = it }, label = { Text("Что случилось?") }, placeholder = { Text("Опишите неисправность") }, modifier = Modifier.fillMaxWidth().height(126.dp), shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(address, { address = it }, label = { Text("Адрес выезда") }, placeholder = { Text("Город, улица, дом") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), singleLine = true)
        Spacer(Modifier.height(16.dp))
        Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFEAF2FE))) {
            Text("Оплата после ремонта: наличными мастеру или картой. Цена согласуется заранее.", Modifier.padding(14.dp), color = Ink, fontSize = 13.sp, lineHeight = 19.sp)
        }
        Spacer(Modifier.height(20.dp))
        Button(onClick = { onSubmit(device.ifBlank { "Бытовая техника" }, problem.ifBlank { "Неисправность требует диагностики" }) }, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(15.dp)) { Text("Отправить заявку", fontWeight = FontWeight.SemiBold) }
        Text("Сейчас заявка сохраняется только на устройстве. Отправка в сервис будет включена после подключения серверной части.", fontSize = 11.sp, lineHeight = 16.sp, color = Muted, modifier = Modifier.padding(top = 10.dp))
    }
}

@Composable
private fun RequestsScreen(requests: List<RepairRequest>) {
    Column(Modifier.padding(20.dp)) {
        Text("Мои заявки", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text("История и статусы ремонта", color = Muted, modifier = Modifier.padding(top = 4.dp, bottom = 18.dp))
        requests.forEachIndexed { index, item ->
            Card(Modifier.fillMaxWidth().padding(bottom = 12.dp), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Заявка №${2458 + index}", Modifier.weight(1f), fontWeight = FontWeight.SemiBold, color = Ink)
                        Text(item.status, color = Blue, fontSize = 11.sp)
                    }
                    Text(item.device, fontSize = 14.sp, color = Ink, modifier = Modifier.padding(top = 12.dp))
                    Text(item.problem, fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 3.dp))
                    Text("Мастер свяжется для подтверждения времени и цены", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 12.dp))
                }
            }
        }
    }
}

@Composable
private fun ChatScreen() {
    Column(Modifier.padding(20.dp)) {
        Text("Чат с сервисом", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text("Здесь можно будет обсудить заявку с мастером", color = Muted, modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(18.dp))
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Text("Чат появится после подтверждения заявки сервисом.", Modifier.padding(18.dp), color = Ink)
        }
    }
}

@Composable
private fun ProfileScreen() {
    Column(Modifier.padding(20.dp)) {
        Text("Профиль", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Ink)
        Spacer(Modifier.height(16.dp))
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Вход по электронной почте", fontWeight = FontWeight.SemiBold, color = Ink)
                Text("Авторизация появится после подключения серверной части.", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 6.dp))
            }
        }
        Spacer(Modifier.height(12.dp))
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Способы оплаты", fontWeight = FontWeight.SemiBold, color = Ink)
                Text("Наличными после ремонта · карта после подключения платёжного сервиса", fontSize = 13.sp, lineHeight = 19.sp, color = Muted, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

@Composable
private fun BottomBar(selected: String, onSelect: (String) -> Unit) {
    val items = listOf("Главная" to "⌂", "Заявки" to "▤", "Чат" to "◌", "Профиль" to "♙")
    Row(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 8.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        items.forEach { (title, icon) ->
            val active = title == selected
            Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).clickable { onSelect(title) }.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(icon, fontSize = 22.sp, color = if (active) Blue else Muted)
                Text(title, fontSize = 10.sp, color = if (active) Blue else Muted, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
            }
        }
    }
}
