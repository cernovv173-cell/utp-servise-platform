package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
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
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandLogo(Modifier.size(40.dp))
        Column(Modifier.padding(start = 10.dp)) {
            Text("ЕНОТ СЕРВИС", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            subtitle?.let { Text(it, fontSize = 11.sp, color = UtpMuted) }
        }
    }
}
