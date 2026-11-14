package ru.utp.servise.data

import android.net.Uri
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object MediaApiClient {
    fun binaryRequest(
        method: String,
        path: String,
        token: String,
        content: ByteArray,
        contentType: String = "image/jpeg",
    ): JSONObject {
        val baseUrl = requireSecureBaseUrl()
        val connection = URL("$baseUrl/api$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", contentType)
            connection.outputStream.use { it.write(content) }
            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(responseText) }.getOrElse { JSONObject() }
            if (statusCode !in 200..299) {
                val error = json.optJSONObject("error")
                throw ApiException(
                    error?.optString("code").orEmpty(),
                    error?.optString("message").takeUnless { it.isNullOrBlank() }
                        ?: "Не удалось загрузить фотографию.",
                )
            }
            return json
        } catch (failure: ApiException) {
            throw failure
        } catch (failure: java.net.SocketTimeoutException) {
            throw ApiException("TIMEOUT", failure.message.orEmpty(), failure)
        } catch (failure: IOException) {
            throw ApiException("NETWORK_ERROR", failure.message.orEmpty(), failure)
        } finally {
            connection.disconnect()
        }
    }

    fun download(token: String, objectId: String): ByteArray {
        val baseUrl = requireSecureBaseUrl()
        val connection = URL("$baseUrl/api/media/${Uri.encode(objectId)}")
            .openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Authorization", "Bearer $token")
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                val responseText = connection.errorStream
                    ?.bufferedReader(Charsets.UTF_8)
                    ?.use { it.readText() }
                    .orEmpty()
                val error = runCatching {
                    JSONObject(responseText).optJSONObject("error")
                }.getOrNull()
                throw ApiException(
                    error?.optString("code").orEmpty(),
                    error?.optString("message").takeUnless { it.isNullOrBlank() }
                        ?: "Не удалось загрузить фотографию.",
                )
            }
            return connection.inputStream.use { it.readBytes() }
        } catch (failure: ApiException) {
            throw failure
        } catch (failure: java.net.SocketTimeoutException) {
            throw ApiException("TIMEOUT", failure.message.orEmpty(), failure)
        } catch (failure: IOException) {
            throw ApiException("NETWORK_ERROR", failure.message.orEmpty(), failure)
        } finally {
            connection.disconnect()
        }
    }

    private fun requireSecureBaseUrl(): String {
        val baseUrl = ApiClient.baseUrl
        if (baseUrl.isBlank()) {
            throw ApiException(
                "API_NOT_CONFIGURED",
                "Адрес сервера ещё не настроен для этой сборки.",
            )
        }
        if (!baseUrl.startsWith("https://")) {
            throw ApiException(
                "HTTPS_REQUIRED",
                "Сервер должен использовать защищённое HTTPS-подключение.",
            )
        }
        return baseUrl
    }
}
