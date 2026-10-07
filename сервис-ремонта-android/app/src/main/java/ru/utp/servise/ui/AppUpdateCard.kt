package ru.utp.servise.ui

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.AndroidAppUpdateResult
import ru.utp.servise.data.AndroidAppUpdater

@Composable
fun AppUpdateCard() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pendingUpdate by remember { mutableStateOf<AndroidAppUpdateResult.Available?>(null) }
    var isChecking by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }

    fun openInstaller(update: AndroidAppUpdateResult.Available) {
        val contentUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            update.apkFile,
        )
        val installerIntent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(contentUri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(installerIntent)
    }

    val installPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        val update = pendingUpdate ?: return@rememberLauncherForActivityResult
        if (context.packageManager.canRequestPackageInstalls()) {
            runCatching { openInstaller(update) }
                .onFailure { status = "Не удалось открыть установщик Android. Повторите проверку обновления." }
        } else {
            status = "Разрешите установку приложений для UTP Servise в настройках Android и повторите попытку."
        }
    }

    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Text("Обновление приложения", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Скачайте новую версию прямо в приложении. Перед установкой мы проверим пакет, версию и подпись.",
                fontSize = 12.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 5.dp, bottom = 10.dp),
            )
            Button(
                onClick = {
                    status = null
                    isChecking = true
                    scope.launch {
                        val result = runCatching {
                            withContext(Dispatchers.IO) {
                                AndroidAppUpdater.downloadAndCheck(context)
                            }
                        }
                        isChecking = false
                        result.onSuccess { update ->
                            when (update) {
                                AndroidAppUpdateResult.AlreadyCurrent ->
                                    status = "У вас уже установлена последняя версия."

                                is AndroidAppUpdateResult.Available -> {
                                    pendingUpdate = update
                                    status = "Доступно обновление ${update.versionName}."
                                    if (context.packageManager.canRequestPackageInstalls()) {
                                        runCatching { openInstaller(update) }
                                            .onFailure {
                                                status = "Не удалось открыть установщик Android. Повторите проверку обновления."
                                            }
                                    } else {
                                        installPermissionLauncher.launch(
                                            Intent(
                                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                                Uri.parse("package:${context.packageName}"),
                                            ),
                                        )
                                    }
                                }
                            }
                        }.onFailure { failure ->
                            status = failure.message?.takeIf(String::isNotBlank)
                                ?: "Не удалось проверить обновление. Проверьте соединение и повторите попытку."
                        }
                    }
                },
                enabled = !isChecking,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
            ) {
                Text(if (isChecking) "Проверяем и скачиваем…" else "Проверить и установить")
            }
            status?.let { message ->
                Text(
                    message,
                    fontSize = 12.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            Text(
                "Android попросит подтвердить установку. Обновление не устанавливается без вашего согласия.",
                fontSize = 11.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}
