package ru.utp.servise.data

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import java.io.File
import java.io.IOException
import java.security.MessageDigest

sealed interface AndroidAppUpdateResult {
    data object AlreadyCurrent : AndroidAppUpdateResult
    data class Available(val apkFile: File, val versionName: String, val versionCode: Long) : AndroidAppUpdateResult
}

object AndroidAppUpdater {
    private const val MAX_ANDROID_APK_BYTES = 100L * 1024 * 1024

    fun downloadAndCheck(context: Context): AndroidAppUpdateResult {
        val updateDirectory = File(context.cacheDir, "updates")
        if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
            throw IOException("Не удалось подготовить место для обновления.")
        }
        val apkFile = File(updateDirectory, "utp-servise-update.apk")
        apkFile.delete()
        ApiClient.downloadCurrentAndroidApk(apkFile)
        try {
            if (apkFile.length() !in 1..MAX_ANDROID_APK_BYTES) {
                throw IOException("Загруженный APK пуст или превышает допустимый размер.")
            }
            val packageManager = context.packageManager
            val installedInfo = packageManager.getPackageInfoCompat(context.packageName)
            val archiveInfo = packageManager.getPackageArchiveInfo(apkFile.absolutePath, signingFlags())
                ?: throw IOException("Сервер вернул файл, который не распознаётся как Android-приложение.")
            if (archiveInfo.packageName != context.packageName) {
                throw SecurityException("APK предназначен для другого приложения.")
            }
            val installedSigners = installedInfo.signerSha256Digests()
            val updateSigners = archiveInfo.signerSha256Digests()
            if (installedSigners.isEmpty() || installedSigners != updateSigners) {
                throw SecurityException("Подпись обновления не совпадает с установленным приложением.")
            }
            val updateVersionCode = archiveInfo.versionCodeCompat()
            if (updateVersionCode <= installedInfo.versionCodeCompat()) {
                apkFile.delete()
                return AndroidAppUpdateResult.AlreadyCurrent
            }
            return AndroidAppUpdateResult.Available(
                apkFile = apkFile,
                versionName = archiveInfo.versionName ?: updateVersionCode.toString(),
                versionCode = updateVersionCode,
            )
        } catch (failure: Exception) {
            apkFile.delete()
            throw failure
        }
    }

    fun installedVersionCode(context: Context): Long =
        context.packageManager.getPackageInfoCompat(context.packageName).versionCodeCompat()

    private fun signingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }

    @Suppress("DEPRECATION")
    private fun PackageManager.getPackageInfoCompat(packageName: String): PackageInfo =
        getPackageInfo(packageName, signingFlags())

    @Suppress("DEPRECATION")
    private fun PackageInfo.versionCodeCompat(): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) longVersionCode else versionCode.toLong()

    @Suppress("DEPRECATION")
    private fun PackageInfo.signerSha256Digests(): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            signingInfo?.apkContentsSigners
        } else {
            signatures
        }
        return signatures.orEmpty().map { signature ->
            MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { byte ->
                (byte.toInt() and 0xff).toString(16).padStart(2, '0')
            }
        }.toSet()
    }
}
