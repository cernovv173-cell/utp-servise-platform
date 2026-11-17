package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun AdminAppSettingsScreen(
    themeMode: ThemeMode,
    onThemeModeChanged: (ThemeMode) -> Unit,
    visible: Boolean,
    onVisibilityChanged: (Boolean) -> Unit,
    onResetPosition: () -> Unit,
    acceptingNewOrders: Boolean?,
    orderIntakeLoadFailed: Boolean,
    onRetryOrderIntake: () -> Unit,
    onAcceptingNewOrdersChanged: (Boolean) -> Unit,
    onOpenVersion: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onBack) {
            Text("← Управление")
        }
        Text(
            text = "Настройки приложения",
            fontSize = 25.sp,
            fontWeight = FontWeight.Bold,
            color = UtpInk,
        )
        Text(
            text = "Быстрый доступ и внешний вид приложения.",
            fontSize = 13.sp,
            color = UtpMuted,
        )
        Text("Тема приложения", fontWeight = FontWeight.SemiBold)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ThemeMode.values().forEach { mode ->
                if (mode == themeMode) {
                    Button(
                        onClick = { onThemeModeChanged(mode) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(mode.title)
                    }
                } else {
                    OutlinedButton(
                        onClick = { onThemeModeChanged(mode) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(mode.title)
                    }
                }
            }
        }
        AdminQuickActionSettings(
            visible = visible,
            onVisibilityChanged = onVisibilityChanged,
            onResetPosition = onResetPosition,
        )
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text("Приём новых заявок", fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(
                            if (acceptingNewOrders == false) "Новые заявки клиентов приостановлены."
                            else "Разрешить клиентам отправлять новые заявки на ремонт.",
                            fontSize = 12.sp,
                            color = UtpMuted,
                        )
                    }
                    Switch(
                        checked = acceptingNewOrders == true,
                        onCheckedChange = onAcceptingNewOrdersChanged,
                        enabled = acceptingNewOrders != null && !orderIntakeLoadFailed,
                    )
                }
                if (acceptingNewOrders == false) {
                    Text(
                        "Текущие заказы остаются доступны; администратор по-прежнему может создать заявку вручную.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                }
                if (orderIntakeLoadFailed) {
                    Text(
                        "Не удалось загрузить настройку.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.error,
                    )
                    OutlinedButton(onClick = onRetryOrderIntake, modifier = Modifier.fillMaxWidth()) {
                        Text("Повторить загрузку")
                    }
                } else if (acceptingNewOrders == null) {
                    Text("Загружаем настройку…", fontSize = 12.sp, color = UtpMuted)
                }
            }
        }
        OutlinedButton(
            onClick = onOpenVersion,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("О версии программы", fontWeight = FontWeight.SemiBold)
                Text("Версия приложения и номер сборки", fontSize = 12.sp)
            }
        }
    }
}
