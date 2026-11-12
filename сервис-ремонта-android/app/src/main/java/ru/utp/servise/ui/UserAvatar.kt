package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import ru.utp.servise.R

@Composable
fun UserAvatar(
    objectId: String?,
    token: String,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    if (objectId.isNullOrBlank()) {
        Image(
            painter = painterResource(R.drawable.mascot_cyberpunk_avatar),
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = ContentScale.Crop,
            alignment = Alignment.TopCenter,
        )
    } else {
        RemoteProjectImage(
            objectId = objectId,
            token = token,
            modifier = modifier,
            contentDescription = contentDescription,
        )
    }
}
