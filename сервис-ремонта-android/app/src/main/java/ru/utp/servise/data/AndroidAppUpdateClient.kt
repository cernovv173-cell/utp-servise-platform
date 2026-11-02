package ru.utp.servise.data

import android.content.Context
import android.content.pm.PackageInfo
import android.os.Build
import org.json.JSONObject
import ru.utp.servise.BuildConfig
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

internal data class AndroidAppUpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val sha256: String,
)

internal object AndroidAppUpdateClient {
    private const val APK_CONTENT_TYPE = "application/vnd.android.package-archive"
    private const val MAX_APK_BYTES = 100L * 1024L * 1024L
    private const val MAX_REDIRECTS = 4

    fun fetchLatestVersion(): AndroidAppUpdateInfo? {
        val response = requestJson("/android-app")
        val apk = response.optJSONObject("apk") ?: return null
        if (apk.optString("state") != "available") return null

        val versionCode = apk.optInt("versionCode", 0)
        val versionName = apk.optString("versionName").trim()
        val sha256 = apk.optString("sha256").trim()
        if (
            versionCode <= 0 ||
            versionName.isEmpty() ||
            !sha256.matches(Regex("[a-f0-9]{64}"))
        ) {
            throw IOException("Не удалось прочитать сведения о новой версии.")
        }
        return AndroidAppUpdateInfo(versionCode, versionName, sha256)
    }

    suspend fun downloadAndVerify(
        context: Context,
        update: AndroidAppUpdateInfo,
        onProgress: suspend (downloadedBytes: Long, totalBytes: Long) -> Unit,
    ): File {
        val directory = File(context.cacheDir, "android-app-updates")
        if (!directory.exists() && !directory.mkdirs()) {
            throw IOException("Не удалось подготовить место для скачивания APK.")
        }

        val temporaryFile = File.createTempFile("utp-update-", ".part", directory)
        var connection: HttpURLConnection? = null
        try {
            connection = openApkDownload()
            val contentLength = connection.contentLengthLong
            if (contentLength > MAX_APK_BYTES) {
                throw IOException("Размер APK превышает допустимый предел.")
            }

            val digest = MessageDigest.getInstance("SHA-256")
            var downloadedBytes = 0L
            var lastProgressAt = 0L
            connection.inputStream.use { input ->
                temporaryFile.outputStream().buffered().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE * 4)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        downloadedBytes += count
                        if (downloadedBytes > MAX_APK_BYTES) {
                            throw IOException("Размер APK превышает допустимый предел.")
                        }
                        digest.update(buffer, 0, count)
                        output.write(buffer, 0, count)

                        val now = System.currentTimeMillis()
                        if (now - lastProgressAt >= 250L || downloadedBytes == contentLength) {
                            onProgress(downloadedBytes, contentLength)
                            lastProgressAt = now
                        }
                    }
                }
            }
            connection.disconnect()
            connection = null

            if (downloadedBytes == 0L) {
                throw IOException("Сервер вернул пустой APK.")
            }
            if (contentLength > 0L && downloadedBytes != contentLength) {
                throw IOException("Загрузка APK завершилась не полностью.")
            }

            val actualSha256 = digest.digest().toLowercaseHex()
            if (actualSha256 != update.sha256) {
                throw IOException("Проверка целостности APK не прошла. Попробуйте скачать его позже.")
            }
            verifyPackage(context, temporaryFile, update)

            val verifiedFile = File(directory, "utp-servise-${update.versionCode}.apk")
            if (verifiedFile.exists() && !verifiedFile.delete()) {
                throw IOException("Не удалось заменить временный APK-файл.")
            }
            if (!temporaryFile.renameTo(verifiedFile)) {
                throw IOException("Не удалось сохранить скачанную APK.")
            }
            onProgress(downloadedBytes, if (contentLength > 0L) contentLength else downloadedBytes)
            return verifiedFile
        } catch (failure: IOException) {
            throw failure
        } catch (failure: Exception) {
            throw IOException("Не удалось скачать APK. Проверьте подключение и попробуйте ещё раз.", failure)
        } finally {
            connection?.disconnect()
            if (temporaryFile.exists()) temporaryFile.delete()
        }
    }

    private fun requestJson(path: String): JSONObject {
        val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
        if (!baseUrl.startsWith("https://")) {
            throw IOException("Сервер приложения должен использовать защищённое HTTPS-подключение.")
        }

        val connection = URL("$baseUrl/api$path").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-cache")
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                throw IOException("Не удалось проверить новую версию приложения.")
            }
            val response = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun openApkDownload(): HttpURLConnection {
        val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
        if (!baseUrl.startsWith("https://")) {
            throw IOException("Сервер приложения должен использовать защищённое HTTPS-подключение.")
        }

        var url = URL("$baseUrl/api/android-app/download")
        repeat(MAX_REDIRECTS + 1) { redirectCount ->
            if (url.protocol != "https") {
                throw IOException("Скачать APK можно только по защищённому HTTPS-подключению.")
            }
            val connection = url.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 20_000
            connection.readTimeout = 90_000
            connection.setRequestProperty("Accept", APK_CONTENT_TYPE)

            val statusCode = connection.responseCode
            if (statusCode in 300..399) {
                val location = connection.getHeaderField("Location")
                connection.disconnect()
                if (location.isNullOrBlank() || redirectCount == MAX_REDIRECTS) {
                    throw IOException("Ссылка для скачивания APK недоступна.")
                }
                url = URL(url, location)
                return@repeat
            }
            if (statusCode !in 200..299) {
                connection.disconnect()
                throw IOException("Не удалось скачать APK. Проверьте подключение и попробуйте ещё раз.")
            }
            return connection
        }
        throw IOException("Не удалось открыть ссылку для скачивания APK.")
    }

    private fun verifyPackage(
        context: Context,
        file: File,
        update: AndroidAppUpdateInfo,
    ) {
        val packageInfo: PackageInfo = context.packageManager.getPackageArchiveInfo(file.absolutePath, 0)
            ?: throw IOException("Скачанный файл не распознан как Android-приложение.")
        val apkVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            packageInfo.versionCode.toLong()
        }

        if (packageInfo.packageName != context.packageName) {
            throw IOException("Скачанный APK относится к другому приложению.")
        }
        if (apkVersionCode != update.versionCode.toLong() || packageInfo.versionName != update.versionName) {
            throw IOException("Версия APK не совпадает с опубликованными сведениями. Загрузите корректный файл.")
        }
        if (apkVersionCode <= BuildConfig.VERSION_CODE.toLong()) {
            throw IOException("В скачанном APK нет версии новее установленной.")
        }
    }

    private fun ByteArray.toLowercaseHex(): String = joinToString("") { byte ->
        "%02x".format(byte)
    }
}
