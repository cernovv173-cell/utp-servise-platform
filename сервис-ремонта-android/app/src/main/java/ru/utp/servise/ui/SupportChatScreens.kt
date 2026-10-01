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
import ru.utp.servise.data.SupportChat
import ru.utp.servise.data.SupportChatInboxItem
import ru.utp.servise.data.roleLabel

@Composable
fun SupportChatInboxScreen(
    chats: List<SupportChatInboxItem>,
    refresh: () -> Unit,
    onOpenChat: (String) -> Unit,
    onBack: () -> Unit,
) {
    val refreshLatest by rememberUpdatedState(refresh)
    LaunchedEffect(Unit) {
        refreshLatest()
        while (true) {
            delay(15_000)
            refreshLatest()
        }
    }
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление") }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Чаты клиентов", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("${chats.size} бесед", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        if (chats.isEmpty()) {
            Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text("Сообщений от клиентов пока нет.", Modifier.padding(16.dp), color = UtpMuted)
            }
        }
        chats.forEach { chat ->
            Card(
                onClick = { onOpenChat(chat.customerId) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(chat.customerName.ifBlank { "Клиент" }, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(chat.customerEmail, fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp))
                    Text(chat.lastMessage, fontSize = 13.sp, color = UtpInk, modifier = Modifier.padding(top = 7.dp))
                    Text("Открыть переписку →", fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
    }
}

@Composable
fun SupportChatScreen(
    customerId: String,
    isAdministrator: Boolean,
    chat: SupportChat?,
    busy: Boolean,
    onRefresh: () -> Unit,
    onSendMessage: (String, () -> Unit) -> Unit,
    onBack: () -> Unit,
) {
    var draft by remember(customerId) { mutableStateOf("") }
    val refreshLatest by rememberUpdatedState(onRefresh)
    LaunchedEffect(customerId, isAdministrator) {
        refreshLatest()
        while (true) {
            delay(8_000)
            refreshLatest()
        }
    }
    val currentChat = chat?.takeIf { it.customerId == customerId }
    val ownRole = if (isAdministrator) "ADMIN" else "CUSTOMER"
    val messageScroll = rememberScrollState()
    LaunchedEffect(currentChat?.messages?.size) {
        messageScroll.animateScrollTo(messageScroll.maxValue)
    }

    Column(Modifier.fillMaxSize().background(UtpPale).padding(horizontal = 16.dp, vertical = 10.dp)) {
        TextButton(onClick = onBack) { Text(if (isAdministrator) "←  Чаты клиентов" else "←  Главная") }
        Text(
            if (isAdministrator) currentChat?.customerName?.ifBlank { null } ?: "Чат с клиентом" else "Чат с администратором",
            fontSize = 23.sp,
            fontWeight = FontWeight.Bold,
            color = UtpInk,
        )
        if (isAdministrator && !currentChat?.customerEmail.isNullOrBlank()) {
            Text(currentChat?.customerEmail.orEmpty(), fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp, bottom = 7.dp))
        } else {
            Spacer(Modifier.height(8.dp))
        }
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(messageScroll),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            if (currentChat == null || currentChat.messages.isEmpty()) {
                Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Text(
                        if (isAdministrator) "Клиент пока не отправлял сообщений." else "Здравствуйте! Напишите администратору — ответ появится здесь.",
                        Modifier.padding(14.dp), fontSize = 12.sp, color = UtpMuted,
                    )
                }
            }
            currentChat?.messages?.forEach { message ->
                val isOwn = message.senderRole == ownRole
                Card(
                    modifier = Modifier.fillMaxWidth(if (isOwn) 0.88f else 1f).align(if (isOwn) Alignment.End else Alignment.Start),
                    shape = RoundedCornerShape(15.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isOwn) androidx.compose.material3.MaterialTheme.colorScheme.primaryContainer else androidx.compose.material3.MaterialTheme.colorScheme.surface,
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
                    onSendMessage(content) { draft = "" }
                },
                enabled = !busy && draft.trim().isNotEmpty(),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Отправить") }
        }
        TextButton(onClick = onRefresh, modifier = Modifier.align(Alignment.End)) { Text("Обновить сообщения") }
    }
}
