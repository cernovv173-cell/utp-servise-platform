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
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.utp.servise.data.AdminChatInboxItem
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.OrderChat
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.roleLabel

@Composable
fun AdminChatInboxScreen(
    chats: List<AdminChatInboxItem>,
    refresh: () -> Unit,
    onOpenChat: (String) -> Unit,
    onBack: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление") }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text("Запросы помощи", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("${chats.size} бесед", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        if (chats.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
                Text("Запросов на подключение администратора пока нет.", Modifier.padding(16.dp), color = UtpMuted)
            }
        }
        chats.forEach { chat ->
            Card(
                onClick = { onOpenChat(chat.orderId) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White),
            ) {
                Column(Modifier.padding(15.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(chat.deviceType.deviceLabel(), fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.weight(1f))
                        Text(if (chat.adminJoinedAt == null) "Ожидает" else "Вы подключены", fontSize = 11.sp, color = UtpBlue)
                    }
                    Text(chat.problem, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp))
                    Text("Клиент: ${chat.customerName.ifBlank { "—" }} · Мастер: ${chat.technicianName.ifBlank { "—" }}", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp))
                    if (chat.lastMessage.isNotBlank()) {
                        Text("Последнее сообщение: ${chat.lastMessage}", fontSize = 12.sp, color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                    }
                    Text("Открыть беседу  →", fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
    }
}

@Composable
fun RepairChatScreen(
    orderId: String,
    role: String,
    token: String,
    chat: OrderChat?,
    busy: Boolean,
    runAction: RunAction,
    onChatUpdated: (OrderChat) -> Unit,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
) {
    var draft by remember(orderId) { mutableStateOf("") }
    val refreshLatest by rememberUpdatedState(onRefresh)
    LaunchedEffect(orderId) {
        while (true) {
            delay(8_000)
            refreshLatest()
        }
    }
    val currentChat = chat?.takeIf { it.orderId == orderId }
    val adminJoined = currentChat?.adminJoinedAt != null

    Column(Modifier.fillMaxSize().background(UtpPale).padding(horizontal = 16.dp, vertical = 10.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Чат по заказу", fontSize = 23.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("№ ${orderId.take(8)}", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp, bottom = 7.dp))

        when {
            adminJoined -> {
                val adminName = currentChat?.adminJoinedByName.orEmpty().ifBlank { "Администратор" }
                Text("$adminName подключился к беседе.", fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(bottom = 6.dp))
            }
            currentChat?.adminRequestedAt != null -> Text("Мастер запросил помощь администратора.", fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(bottom = 6.dp))
            role == "ADMIN" -> Text("Мастер ещё не запрашивал помощь.", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(bottom = 6.dp))
        }

        if (role == "ADMIN" && currentChat?.adminRequestedAt != null && !adminJoined) {
            Button(
                onClick = {
                    runAction({ ApiClient.joinOrderChatAsAdministrator(token, orderId) }) { result ->
                        (result as? OrderChat)?.let(onChatUpdated)
                    }
                },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().padding(bottom = 7.dp),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Подключиться к беседе") }
        }

        if (role == "TECHNICIAN" && !adminJoined && currentChat?.adminRequestedAt == null) {
            OutlinedButton(
                onClick = {
                    runAction({ ApiClient.requestAdministratorHelp(token, orderId) }) { result ->
                        (result as? OrderChat)?.let(onChatUpdated)
                    }
                },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().padding(bottom = 7.dp),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Позвать администратора") }
        }

        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            if (currentChat == null || currentChat.messages.isEmpty()) {
                Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
                    Text("Напишите сообщение по ремонту. Переписка доступна клиенту, назначенному мастеру и подключившемуся администратору.", Modifier.padding(14.dp), fontSize = 12.sp, color = UtpMuted)
                }
            }
            currentChat?.messages?.forEach { message ->
                val isOwn = message.senderRole == role
                Card(
                    modifier = Modifier.fillMaxWidth(if (isOwn) 0.88f else 1f).align(if (isOwn) Alignment.End else Alignment.Start),
                    shape = RoundedCornerShape(15.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isOwn) androidx.compose.ui.graphics.Color(0xFFE4EEFC) else androidx.compose.ui.graphics.Color.White,
                    ),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(message.senderName, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue, modifier = Modifier.weight(1f))
                            if (message.senderRole.isNotBlank()) Text(message.senderRole.roleLabel(), fontSize = 10.sp, color = UtpMuted)
                        }
                        Text(message.content, fontSize = 14.sp, color = UtpInk, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        if (role == "ADMIN" && !adminJoined) {
            Text("Подключитесь к чату из запроса, чтобы отправлять сообщения.", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(bottom = 6.dp))
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it.take(2000) },
                label = { Text("Сообщение") },
                modifier = Modifier.weight(1f),
                maxLines = 4,
                shape = RoundedCornerShape(14.dp),
            )
            Button(
                onClick = {
                    val content = draft.trim()
                    runAction({ ApiClient.sendChatMessage(token, orderId, content) }) { result ->
                        (result as? OrderChat)?.let(onChatUpdated)
                        draft = ""
                    }
                },
                enabled = !busy && draft.trim().isNotEmpty() && (role != "ADMIN" || adminJoined),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Отправить") }
        }
        TextButton(onClick = onRefresh, modifier = Modifier.align(Alignment.End)) { Text("Обновить сообщения") }
    }
}
