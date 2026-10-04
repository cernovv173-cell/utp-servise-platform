package ru.utp.servise.ui

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
internal fun ServiceNumberBarcode(serviceNumber: String) {
    val bitmap by produceState<Bitmap?>(null, serviceNumber) {
        value = runCatching {
            withContext(Dispatchers.Default) {
                val matrix = MultiFormatWriter().encode(serviceNumber, BarcodeFormat.CODE_128, 640, 96)
                val width = matrix.width
                val height = matrix.height
                val pixels = IntArray(width * height) { AndroidColor.WHITE }
                val middleRow = height / 2
                for (x in 0 until width) {
                    if (matrix.get(x, middleRow)) {
                        for (y in 0 until height) pixels[y * width + x] = AndroidColor.BLACK
                    }
                }
                Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
                    setPixels(pixels, 0, width, 0, 0, width, height)
                }
            }
        }.getOrNull()
    }

    bitmap?.let { image ->
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "ШТРИХКОД ЗАЯВКИ",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Image(
                bitmap = image.asImageBitmap(),
                contentDescription = "Штрихкод заявки $serviceNumber",
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp).aspectRatio(6.67f),
            )
            Text(
                serviceNumber,
                color = Color.DarkGray,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}
