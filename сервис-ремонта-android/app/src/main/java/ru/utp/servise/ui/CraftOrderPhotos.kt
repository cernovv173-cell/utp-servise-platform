package ru.utp.servise.ui

import android.content.Context
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient

private const val MAX_CRAFT_ORDER_PHOTOS = 3

@Composable
internal fun CraftOrderPhotoAttachments(
    photos: List<Uri>,
    onPhotosChanged: (List<Uri>) -> Unit,
    enabled: Boolean = true,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PhotoPickerButton(
            label = if (photos.isEmpty()) "Добавить фото" else "Добавить ещё фото · ${photos.size}/$MAX_CRAFT_ORDER_PHOTOS",
            enabled = enabled && photos.size < MAX_CRAFT_ORDER_PHOTOS,
        ) { uri ->
            if (photos.size < MAX_CRAFT_ORDER_PHOTOS && uri !in photos) {
                onPhotosChanged(photos + uri)
            }
        }
        Text("До 3 фото. Они прикрепятся к чату заявки.", fontSize = 11.sp, color = UtpMuted)
        photos.forEachIndexed { index, photo ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Фото ${index + 1} выбрано", modifier = Modifier.weight(1f), fontSize = 12.sp, color = UtpMuted)
                TextButton(
                    onClick = { onPhotosChanged(photos.filterNot { it == photo }) },
                    enabled = enabled,
                ) {
                    Text("Убрать")
                }
            }
        }
    }
}

internal fun createCraftOrderWithPhotos(
    context: Context,
    token: String,
    itemId: String?,
    customTitle: String?,
    quantity: Int,
    note: String,
    photos: List<Uri>,
): Int {
    val order = ApiClient.createCraftOrder(token, itemId, customTitle, quantity, note)
    return photos.take(MAX_CRAFT_ORDER_PHOTOS).count { uri ->
        runCatching {
            ApiClient.uploadCraftOrderChatImage(
                token,
                order.id,
                compressSelectedImage(context, uri),
            )
        }.isFailure
    }
}
