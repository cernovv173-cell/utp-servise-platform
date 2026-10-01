package ru.utp.servise.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun CompanyMediaPreview(url: String) {
    val uriHandler = LocalUriHandler.current
    val video = url.substringBefore('?').substringBefore('#').lowercase().let {
        it.endsWith(".mp4") || it.endsWith(".webm") || it.endsWith(".mov")
    }
    var image by remember(url) { mutableStateOf<Bitmap?>(null) }
    var loading by remember(url) { mutableStateOf(!video) }

    LaunchedEffect(url, video) {
        if (!video) {
            image = withContext(Dispatchers.IO) { loadCompanyImage(url) }
            loading = false
        }
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val preview = image
            if (preview != null) {
                Image(
                    bitmap = preview.asImageBitmap(),
                    contentDescription = "Фотография о компании",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 280.dp).clip(RoundedCornerShape(12.dp))
                        .clickable { runCatching { uriHandler.openUri(url) } },
                )
            } else if (loading) {
                CircularProgressIndicator(modifier = Modifier.padding(18.dp))
            } else {
                OutlinedButton(onClick = { runCatching { uriHandler.openUri(url) } }) {
                    Text(if (video) "▶  Открыть видео" else "Открыть материал")
                }
            }
        }
    }
}

private fun loadCompanyImage(url: String): Bitmap? = runCatching {
    val parsedUrl = URL(url)
    if (parsedUrl.protocol != "https") return null
    val connection = parsedUrl.openConnection() as HttpURLConnection
    try {
        connection.connectTimeout = 8_000
        connection.readTimeout = 12_000
        connection.instanceFollowRedirects = true
        if (connection.responseCode !in 200..299 || connection.contentType?.startsWith("image/") != true) return null
        if (connection.url.protocol != "https" || connection.contentLengthLong > MAX_IMAGE_BYTES) return null
        val bytes = connection.inputStream.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8_192)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > MAX_IMAGE_BYTES) return null
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sampleSize = 1
        while (bounds.outWidth / sampleSize > MAX_PREVIEW_WIDTH || bounds.outHeight / sampleSize > MAX_PREVIEW_HEIGHT) {
            sampleSize *= 2
        }
        BitmapFactory.decodeByteArray(
            bytes,
            0,
            bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sampleSize },
        )
    } finally {
        connection.disconnect()
    }
}.getOrNull()

private const val MAX_IMAGE_BYTES = 12 * 1024 * 1024
private const val MAX_PREVIEW_WIDTH = 1_600
private const val MAX_PREVIEW_HEIGHT = 1_200
