package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrderFollowUp

@Composable
internal fun CustomerRepairFollowUpScreen(
    orderId: String,
    token: String,
    onBack: () -> Unit,
    onOpenReview: (String) -> Unit,
    onOpenSupport: () -> Unit,
    onError: (String) -> Unit,
    runAction: RunAction,
) {
    var followUp by remember(orderId) { mutableStateOf<RepairOrderFollowUp?>(null) }
    var isLoading by remember(orderId) { mutableStateOf(true) }
    var loadAttempt by remember(orderId) { mutableIntStateOf(0) }

    LaunchedEffect(orderId, token, loadAttempt) {
        isLoading = true
        try {
            followUp = withContext(Dispatchers.IO) {
                ApiClient.repairOrderFollowUp(token, orderId)
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            followUp = null
        } finally {
            isLoading = false
        }
    }

    val savedFollowUp = followUp
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        TextButton(onClick = onBack) { Text("Назад") }
        Text("Как прошёл ремонт?", style = MaterialTheme.typography.headlineSmall)
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
        } else if (savedFollowUp == null) {
            Text("Не удалось открыть напоминание. Проверьте подключение и попробуйте ещё раз.")
            OutlinedButton(onClick = { loadAttempt += 1 }) { Text("Повторить") }
            TextButton(onClick = onOpenSupport) { Text("Открыть поддержку") }
        } else {
            Text("Заявка ${savedFollowUp.serviceNumber}")
            Text(
                listOfNotNull(savedFollowUp.deviceBrand, savedFollowUp.deviceModel)
                    .joinToString(" ")
                    .ifBlank { savedFollowUp.deviceType },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            when (savedFollowUp.status) {
                "SENT" -> {
                    Text("Всё ли работает после ремонта? Ваш ответ поможет нам быстро помочь, если что-то не так.")
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            runAction({
                                ApiClient.respondToRepairOrderFollowUp(token, orderId, "WORKING")
                            }) { result ->
                                (result as? RepairOrderFollowUp)?.let { followUp = it }
                                    ?: onError("Не удалось сохранить ответ.")
                            }
                        },
                    ) { Text("Да, всё работает") }
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            runAction({
                                ApiClient.respondToRepairOrderFollowUp(token, orderId, "NEEDS_HELP")
                            }) { result ->
                                val updated = result as? RepairOrderFollowUp
                                if (updated == null) onError("Не удалось отправить обращение.")
                                else {
                                    followUp = updated
                                    onOpenSupport()
                                }
                            }
                        },
                    ) { Text("Нужна помощь") }
                }

                "WORKING" -> {
                    Text("Спасибо, что проверили! Рады, что техника работает.")
                    if (savedFollowUp.hasReview) {
                        Text("Вы уже оставили отзыв по этой заявке. Спасибо!")
                    } else {
                        Text("Если хотите, можете оставить честный отзыв о сервисе — это необязательно.")
                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { onOpenReview(orderId) },
                        ) { Text("Оставить отзыв") }
                    }
                }

                "NEEDS_HELP" -> {
                    Text("Обращение по заявке уже передано в поддержку.")
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onOpenSupport,
                    ) { Text("Открыть чат поддержки") }
                }

                "FAILED" -> {
                    Text("Не удалось доставить напоминание. Если нужна помощь, напишите нам в поддержку.")
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = onOpenSupport,
                    ) { Text("Открыть чат поддержки") }
                }

                else -> Text("Напоминание ещё готовится. Попробуйте открыть его позже.")
            }
        }
    }
}
