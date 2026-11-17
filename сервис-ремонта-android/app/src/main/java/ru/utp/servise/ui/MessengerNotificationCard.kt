package ru.utp.servise.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private const val VK_COMMUNITY_URL = "https://vk.ru/remont_pk_puhkino"

@Composable
fun MessengerNotificationCard(
    serviceName: String,
    available: Boolean = true,
    connected: Boolean,
    linkUrl: String?,
    onConnect: () -> Unit,
    onCheckConnection: () -> Unit,
    onDisconnect: () -> Unit,
    showVkCommunityAction: Boolean = false,
) {
    val context = LocalContext.current
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Text("Уведомления в $serviceName", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Сообщим, когда устройство принято, диагностика завершена и заказ готов к выдаче.",
                fontSize = 12.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 5.dp),
            )
            if (!available) {
                Text(
                    "$serviceName пока не подключён; уведомления недоступны.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 10.dp),
                )
                if (showVkCommunityAction) {
                    VkCommunityButton(Modifier.fillMaxWidth().padding(top = 8.dp))
                }
            } else if (connected) {
                Text(
                    "$serviceName подключён",
                    fontSize = 13.sp,
                    color = UtpBlue,
                    modifier = Modifier.padding(top = 10.dp),
                )
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onDisconnect,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                    ) { Text("Отключить") }
                    if (showVkCommunityAction) {
                        VkCommunityButton(Modifier.weight(1f))
                    }
                }
            } else if (linkUrl != null) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = {
                            runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(linkUrl)))
                            }
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Text(
                            if (showVkCommunityAction) "Открыть MAX"
                            else "Открыть $serviceName и подтвердить",
                        )
                    }
                    if (showVkCommunityAction) {
                        VkCommunityButton(Modifier.weight(1f))
                    }
                }
                OutlinedButton(
                    onClick = onCheckConnection,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    shape = RoundedCornerShape(16.dp),
                ) { Text("Проверить подключение") }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Button(
                        onClick = onConnect,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                    ) { Text("Подключить $serviceName") }
                    if (showVkCommunityAction) {
                        VkCommunityButton(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun VkCommunityButton(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    OutlinedButton(
        onClick = {
            runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(VK_COMMUNITY_URL)))
            }
        },
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
    ) { Text("Группа ВК") }
}
