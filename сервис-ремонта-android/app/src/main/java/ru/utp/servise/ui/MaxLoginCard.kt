package ru.utp.servise.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.MaxLoginPoll
import ru.utp.servise.data.MaxLoginStart
import java.time.Instant

private enum class MaxLoginPhase { Idle, Starting, Waiting, Error }

@Composable
internal fun MaxLoginCard(
    referralCode: String,
    enabled: Boolean,
    onBusy: (Boolean) -> Unit,
    onError: (String?) -> Unit,
    onAuthenticated: (String, AppUser) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var available by remember { mutableStateOf<Boolean?>(null) }
    var phase by remember { mutableStateOf(MaxLoginPhase.Idle) }
    var awaitingContact by remember { mutableStateOf(false) }
    var session by remember { mutableStateOf<MaxLoginStart?>(null) }
    var message by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        available = runCatching {
            withContext(Dispatchers.IO) { ApiClient.maxLoginAvailable() }
        }.getOrDefault(false)
    }

    fun openChat(url: String) {
        runCatching {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }.onFailure {
            message = "Не удалось открыть МАКС автоматически. Нажмите «Открыть чат с ботом»."
        }
    }

    fun begin() {
        onError(null)
        message = null
        awaitingContact = false
        scope.launch {
            phase = MaxLoginPhase.Starting
            onBusy(true)
            try {
                val started = withContext(Dispatchers.IO) {
                    ApiClient.startMaxLogin(referralCode.trim().takeIf { it.isNotEmpty() })
                }
                session = started
                phase = MaxLoginPhase.Waiting
                openChat(started.url)
            } catch (failure: Throwable) {
                message = failure.message ?: "Не удалось начать вход через МАКС. Попробуйте ещё раз."
                phase = MaxLoginPhase.Error
            } finally {
                onBusy(false)
            }
        }
    }

    LaunchedEffect(session?.pollToken) {
        val started = session ?: return@LaunchedEffect
        val deadline = runCatching { Instant.parse(started.expiresAt).toEpochMilli() }
            .getOrDefault(System.currentTimeMillis() + 10 * 60 * 1000L)
        while (isActive) {
            val poll = runCatching {
                withContext(Dispatchers.IO) { ApiClient.pollMaxLogin(started.pollToken) }
            }.getOrElse { failure ->
                message = failure.message
                    ?: "Не удалось получить подтверждение из МАКСа. Проверьте подключение."
                phase = MaxLoginPhase.Error
                session = null
                return@LaunchedEffect
            }
            when (poll) {
                is MaxLoginPoll.Completed -> {
                    session = null
                    phase = MaxLoginPhase.Idle
                    onAuthenticated(poll.result.accessToken, poll.result.user)
                    return@LaunchedEffect
                }

                is MaxLoginPoll.Failed -> {
                    message = poll.message
                    phase = MaxLoginPhase.Error
                    session = null
                    return@LaunchedEffect
                }

                is MaxLoginPoll.Pending -> awaitingContact = poll.awaitingContact
            }
            if (System.currentTimeMillis() >= deadline) {
                message = "Время ожидания истекло. Нажмите «Попробовать снова»."
                phase = MaxLoginPhase.Error
                session = null
                return@LaunchedEffect
            }
            delay(2_000)
        }
    }

    if (available == null) return
    if (available == false) {
        Text(
            "Вход через МАКС временно недоступен. Войдите по почте или попробуйте позже.",
            fontSize = 12.sp,
            color = UtpMuted,
        )
        return
    }

    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .border(1.dp, UtpBlue.copy(alpha = 0.3f), RoundedCornerShape(18.dp))
            .padding(16.dp),
    ) {
        Text(
            "Вход и регистрация через МАКС",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = UtpInk,
        )
        Text(
            "Без пароля: бот подтвердит ваш номер телефона. Если аккаунта ещё нет, он создастся автоматически.",
            fontSize = 12.sp,
            color = UtpMuted,
            lineHeight = 17.sp,
            modifier = Modifier.padding(top = 4.dp),
        )
        message?.let {
            Text(
                it,
                fontSize = 12.sp,
                color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        when (phase) {
            MaxLoginPhase.Idle, MaxLoginPhase.Starting, MaxLoginPhase.Error -> Button(
                onClick = { begin() },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                enabled = enabled && phase != MaxLoginPhase.Starting,
                shape = RoundedCornerShape(15.dp),
            ) {
                Text(
                    when (phase) {
                        MaxLoginPhase.Starting -> "Открываем МАКС…"
                        MaxLoginPhase.Error -> "Попробовать снова"
                        else -> "Продолжить в МАКС"
                    },
                )
            }

            MaxLoginPhase.Waiting -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Column(Modifier.padding(start = 10.dp)) {
                        Text(
                            if (awaitingContact) "Подтвердите номер телефона в боте"
                            else "Ожидаем подтверждение в МАКС",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = UtpInk,
                        )
                        Text(
                            if (awaitingContact) {
                                "В чате с ботом нажмите «Поделиться контактом» — это подтвердит, что номер ваш."
                            } else {
                                "Откройте МАКС и нажмите «Начать» в чате с ботом."
                            },
                            fontSize = 12.sp,
                            color = UtpMuted,
                            lineHeight = 17.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                session?.let { started ->
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { openChat(started.url) },
                        modifier = Modifier.fillMaxWidth().height(44.dp),
                        shape = RoundedCornerShape(15.dp),
                    ) { Text("Открыть чат с ботом") }
                }
                TextButton(
                    onClick = {
                        session = null
                        phase = MaxLoginPhase.Idle
                        message = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Отменить") }
            }
        }
        Text(
            "Продолжая, вы разрешаете использовать номер телефона из МАКС для входа и связи по заказам.",
            fontSize = 11.sp,
            color = UtpMuted,
            lineHeight = 15.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
