package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.utp.servise.data.AndroidAppUpdateInfo

@Composable
internal fun AndroidAppUpdateDialog(
    update: AndroidAppUpdateInfo,
    isDownloading: Boolean,
    progress: Float?,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onUpdate: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!isDownloading) onDismiss() },
        title = { Text("Доступно обновление") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Новая версия ${update.versionName} · сборка ${update.versionCode}",
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Скачивание начнётся с сайта. Перед установкой Android попросит подтвердить обновление.",
                )
                if (isDownloading) {
                    if (progress == null) {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    } else {
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Text("Скачано ${(progress * 100).toInt()}%")
                    }
                }
                if (errorMessage != null) {
                    Text(errorMessage, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(onClick = onUpdate, enabled = !isDownloading) {
                Text(if (isDownloading) "Скачиваем…" else "Обновить")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isDownloading) {
                Text("Позже")
            }
        },
    )
}
