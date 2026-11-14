package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R

@Composable
internal fun BrandLogo(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.utp_servise_logo),
        contentDescription = "Логотип ЕНОТ СЕРВИС",
        contentScale = ContentScale.Crop,
        modifier = modifier.clip(RoundedCornerShape(12.dp)),
    )
}

@Composable
internal fun BrandHeader(
    modifier: Modifier = Modifier,
    subtitle: String? = "Сервис ремонта техники",
    onOpenSections: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandLogo(Modifier.size(40.dp))
        Column(Modifier.weight(1f).padding(start = 10.dp, end = 8.dp)) {
            Text(
                "ЕНОТ СЕРВИС",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = UtpInk,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            subtitle?.let {
                Text(it, fontSize = 11.sp, color = UtpMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (onOpenSections != null) {
            FilledTonalButton(
                onClick = onOpenSections,
                modifier = Modifier.height(44.dp),
                shape = RoundedCornerShape(14.dp),
                contentPadding = PaddingValues(horizontal = 9.dp, vertical = 0.dp),
            ) {
                Icon(Icons.Filled.Settings, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text("Все разделы", fontSize = 10.sp, maxLines = 1)
            }
        }
    }
}
