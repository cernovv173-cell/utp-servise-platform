package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
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
