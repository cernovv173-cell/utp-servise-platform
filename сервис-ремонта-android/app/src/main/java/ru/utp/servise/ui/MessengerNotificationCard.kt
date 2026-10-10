package ru.utp.servise.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
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

@Composable
fun MessengerNotificationCard(
    serviceName: String,
    available: Boolean = true,
    connected: Boolean,
    linkUrl: String?,
    onConnect: () -> Unit,
    onCheckConnection: () -> Unit,
    onDisconnect: () -> Unit,
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
            } else if (connected) {
                Text(
                    "$serviceName подключён",
                    fontSize = 13.sp,
                    color = UtpBlue,
                    modifier = Modifier.padding(top = 10.dp),
                )
                OutlinedButton(
                    onClick = onDisconnect,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                ) { Text("Отключить $serviceName") }
            } else if (linkUrl != null) {
                OutlinedButton(
                    onClick = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(linkUrl)))
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                ) { Text("Открыть $serviceName и подтвердить") }
                OutlinedButton(
                    onClick = onCheckConnection,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    shape = RoundedCornerShape(16.dp),
                ) { Text("Проверить подключение") }
            } else {
                Button(
                    onClick = onConnect,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                ) { Text("Подключить $serviceName") }
            }
        }
    }
}
