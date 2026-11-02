package ru.utp.servise.ui

import android.content.ActivityNotFoundException
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.BuildConfig
import ru.utp.servise.data.AndroidAppUpdateClient
import ru.utp.servise.data.AndroidAppUpdateInfo
import ru.utp.servise.data.AndroidAppUpdateInstaller
import java.io.File

@Composable
internal fun AndroidAppUpdateGate(checkTrigger: Int) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var latestUpdate by remember { mutableStateOf<AndroidAppUpdateInfo?>(null) }
    var dismissedVersionCode by remember { mutableIntStateOf(0) }
    var canInstallFromThisApp by remember(context) {
        mutableStateOf(AndroidAppUpdateInstaller.canInstallFromThisApp(context))
    }
    var isDownloading by remember { mutableStateOf(false) }
    var downloadProgress by remember { mutableStateOf<Float?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var downloadedApk by remember { mutableStateOf<File?>(null) }

    LaunchedEffect(checkTrigger) {
        if (checkTrigger == 0) return@LaunchedEffect
        val update = withContext(Dispatchers.IO) {
            runCatching { AndroidAppUpdateClient.fetchLatestVersion() }.getOrNull()
        }
        if (
            update != null &&
            update.versionCode > BuildConfig.VERSION_CODE &&
            update.versionCode != dismissedVersionCode
        ) {
            latestUpdate = update
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        canInstallFromThisApp = AndroidAppUpdateInstaller.canInstallFromThisApp(context)
        if (!canInstallFromThisApp) {
            errorMessage = "Разрешите установку приложений из этого источника в настройках Android и вернитесь сюда."
        } else {
            errorMessage = null
        }
    }

    val onUpdate: () -> Unit = updateAction@{
        val update = latestUpdate ?: return@updateAction
        if (!canInstallFromThisApp) {
            errorMessage = "Чтобы продолжить, разрешите установку APK из этого источника в настройках Android."
            try {
                permissionLauncher.launch(AndroidAppUpdateInstaller.installSettingsIntent(context))
            } catch (_: ActivityNotFoundException) {
                errorMessage = "Не удалось открыть настройки установки приложений на этом устройстве."
            }
            return@updateAction
        }
        if (isDownloading) return@updateAction

        errorMessage = null
        val existingApk = downloadedApk?.takeIf(File::exists)
        if (existingApk != null) {
            runCatching { AndroidAppUpdateInstaller.launchInstaller(context, existingApk) }
                .onFailure {
                    errorMessage = "Не удалось открыть установщик Android. Попробуйте ещё раз."
                }
            return@updateAction
        }

        scope.launch {
            isDownloading = true
            downloadProgress = null
            try {
                val apk = withContext(Dispatchers.IO) {
                    AndroidAppUpdateClient.downloadAndVerify(context, update) { downloaded, total ->
                        withContext(Dispatchers.Main) {
                            downloadProgress = if (total > 0L) {
                                (downloaded.toFloat() / total.toFloat()).coerceIn(0f, 1f)
                            } else {
                                null
                            }
                        }
                    }
                }
                downloadedApk = apk
                AndroidAppUpdateInstaller.launchInstaller(context, apk)
            } catch (_: Exception) {
                errorMessage = "Не удалось подготовить обновление. Проверьте интернет и попробуйте ещё раз."
            } finally {
                isDownloading = false
            }
        }
    }

    latestUpdate?.let { update ->
        AndroidAppUpdateDialog(
            update = update,
            isDownloading = isDownloading,
            progress = downloadProgress,
            errorMessage = errorMessage,
            onDismiss = {
                dismissedVersionCode = update.versionCode
                latestUpdate = null
                errorMessage = null
            },
            onUpdate = onUpdate,
        )
    }
}

