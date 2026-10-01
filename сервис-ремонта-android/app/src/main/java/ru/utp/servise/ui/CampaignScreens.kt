package ru.utp.servise.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.SiteBanner

@Composable
fun CampaignBannerCard(
    banner: SiteBanner,
    token: String,
    onNavigate: (String) -> Unit = {},
) {
    val uriHandler = LocalUriHandler.current
    val currentTime = System.currentTimeMillis()
    if (
        !banner.isActive ||
        (banner.startsAt?.let { parseCampaignDate(it) > currentTime } == true) ||
        (banner.endsAt?.let { parseCampaignDate(it) <= currentTime } == true)
    ) return
    Card(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clickable {
            val target = banner.targetUrl.orEmpty()
            val internal = target.substringAfter("app://", "").lowercase()
            if (internal.isNotBlank()) onNavigate(internal)
            else if (target.startsWith("https://") || target.startsWith("http://")) {
                runCatching { uriHandler.openUri(target) }
            }
        },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column {
            banner.imageObjectId?.let { objectId ->
                RemoteProjectImage(
                    objectId,
                    token,
                    Modifier.fillMaxWidth().height(170.dp),
                    "Рекламный баннер ${banner.title}",
                )
            }
            Column(Modifier.padding(14.dp)) {
                Text("Предложение сервиса", color = UtpBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text(banner.title, color = UtpInk, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 3.dp))
                Text(banner.content, color = UtpMuted, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 5.dp))
                if (!banner.targetUrl.isNullOrBlank()) {
                    Text("Подробнее →", color = UtpBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
    }
}

private fun parseCampaignDate(value: String): Long =
    runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrDefault(0L)
