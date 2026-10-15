package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.LoyaltyAccount
import ru.utp.servise.data.SiteBanner
import java.time.Instant

@Composable
fun LoyaltyScreen(
    account: LoyaltyAccount,
    token: String,
    banners: List<SiteBanner>,
    onCampaignNavigate: (String) -> Unit,
) {
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Программа лояльности", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        CampaignBannerCarousel(
            banners = banners,
            placement = "LOYALTY",
            token = token,
            onNavigate = onCampaignNavigate,
        )
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                Text("Бонусный баланс", fontSize = 13.sp, color = UtpMuted)
                Text("${account.balance} ₽", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = UtpBlue, modifier = Modifier.padding(top = 4.dp))
                Text("Начисляем 10% после подтверждения оплаты чека. При оплате можно списать не более 30% его суммы.", fontSize = 13.sp, color = UtpMuted, lineHeight = 19.sp, modifier = Modifier.padding(top = 8.dp))
            }
        }
        Text("История начислений и списаний", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.padding(top = 6.dp))
        if (account.transactions.isEmpty()) Text("Операций пока нет. Баллы начисляются после подтверждения оплаты.", color = UtpMuted)
        account.transactions.forEach { entry ->
            Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(entry.reason, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = UtpInk)
                        val date = runCatching { Instant.parse(entry.createdAt).atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString() }.getOrDefault(entry.createdAt.take(10))
                        Text(listOfNotNull(date, entry.serviceNumber).joinToString(" · "), fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
                    }
                    Text("${if (entry.points > 0) "+" else ""}${entry.points} ₽", color = if (entry.points >= 0) UtpBlue else androidx.compose.material3.MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
