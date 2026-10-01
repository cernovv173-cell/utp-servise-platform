package ru.utp.servise.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.graphics.ImageDecoder
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max
import kotlin.math.min

private const val MAX_EDGE = 1600
private const val MAX_IMAGE_BYTES = 5 * 1024 * 1024

@Composable
fun PhotoPickerButton(
    label: String,
    enabled: Boolean = true,
    onImageSelected: (Uri) -> Unit,
) {
    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let(onImageSelected) }
    OutlinedButton(
        onClick = {
            picker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(label)
    }
}

@Composable
fun RemoteProjectImage(
    objectId: String?,
    token: String,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val bitmap by produceState<Bitmap?>(null, objectId, token) {
        value = if (objectId.isNullOrBlank()) {
            null
        } else {
            withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = ApiClient.downloadMedia(token, objectId)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                }.getOrNull()
            }
        }
    }
    if (bitmap != null) {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = modifier
                .clip(RoundedCornerShape(12.dp))
                .background(UtpMint),
            contentAlignment = Alignment.Center,
        ) {
            Text("Фото", fontSize = 11.sp, color = UtpMuted)
        }
    }
}

fun compressSelectedImage(context: Context, uri: Uri): ByteArray {
    val bitmap = decodeBitmap(context, uri)
        ?: throw IOException("Не удалось открыть выбранное изображение.")
    var current = resize(bitmap, MAX_EDGE)
    if (current !== bitmap) bitmap.recycle()

    try {
        while (true) {
            val output = ByteArrayOutputStream()
            current.compress(Bitmap.CompressFormat.JPEG, 82, output)
            val bytes = output.toByteArray()
            if (bytes.size <= MAX_IMAGE_BYTES) return bytes
            if (max(current.width, current.height) <= 800) {
                throw IOException("Изображение слишком большое после сжатия.")
            }
            val smaller = Bitmap.createScaledBitmap(
                current,
                max(1, (current.width * 0.7f).toInt()),
                max(1, (current.height * 0.7f).toInt()),
                true,
            )
            current.recycle()
            current = smaller
        }
    } finally {
        if (!current.isRecycled) current.recycle()
    }
}

private fun decodeBitmap(context: Context, uri: Uri): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        return ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.isMutableRequired = true
            val scale = min(
                1f,
                MAX_EDGE.toFloat() / max(info.size.width, info.size.height),
            )
            decoder.setTargetSize(
                max(1, (info.size.width * scale).toInt()),
                max(1, (info.size.height * scale).toInt()),
            )
        }
    }

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    val boundsStream = context.contentResolver.openInputStream(uri) ?: return null
    boundsStream.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    val sample = max(
        1,
        max(bounds.outWidth, bounds.outHeight) / MAX_EDGE,
    )
    val options = BitmapFactory.Options().apply { inSampleSize = sample }
    return context.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, options)
    }
}

private fun resize(bitmap: Bitmap, maxEdge: Int): Bitmap {
    val scale = min(1f, maxEdge.toFloat() / max(bitmap.width, bitmap.height))
    if (scale >= 1f) return bitmap
    return Bitmap.createScaledBitmap(
        bitmap,
        max(1, (bitmap.width * scale).toInt()),
        max(1, (bitmap.height * scale).toInt()),
        true,
    )
}
