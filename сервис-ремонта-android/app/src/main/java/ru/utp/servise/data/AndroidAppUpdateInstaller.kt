package ru.utp.servise.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File

internal object AndroidAppUpdateInstaller {
    private const val FILE_PROVIDER_SUFFIX = ".fileprovider"
    private const val APK_CONTENT_TYPE = "application/vnd.android.package-archive"

    fun canInstallFromThisApp(context: Context): Boolean =
        context.packageManager.canRequestPackageInstalls()

    fun installSettingsIntent(context: Context): Intent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${context.packageName}"),
    )

    fun launchInstaller(context: Context, apkFile: File) {
        val uri = FileProvider.getUriForFile(
            context,
            context.packageName + FILE_PROVIDER_SUFFIX,
            apkFile,
        )
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, APK_CONTENT_TYPE)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(installIntent)
    }
}
