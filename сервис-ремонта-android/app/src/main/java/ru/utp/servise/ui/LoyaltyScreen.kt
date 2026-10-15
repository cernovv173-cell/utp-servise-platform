package ru.utp.servise.ui

import android.content.Intent
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
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.LoyaltyAccount
import ru.utp.servise.data.ReferralProgram
import ru.utp.servise.data.SiteBanner
import java.time.Instant

@Composable
fun LoyaltyScreen(
    account: LoyaltyAccount,
    referralProgram: ReferralProgram,
    token: String,
    banners: List<SiteBanner>,
    onCampaignNavigate: (String) -> Unit,
) {
    val context = LocalContext.current
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
                Text("${account.balance} баллов", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = UtpBlue, modifier = Modifier.padding(top = 4.dp))
                Text("1 балл = 1 ₽ скидки на услуги ремонта. Баллы нельзя вывести или перевести.", fontSize = 13.sp, color = UtpMuted, lineHeight = 19.sp, modifier = Modifier.padding(top = 8.dp))
            }
        }
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("Как начисляются и используются баллы", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("• 10% от суммы ремонта, оплаченной деньгами, после подтверждения оплаты.", fontSize = 12.sp, color = UtpMuted, lineHeight = 18.sp)
                Text("• 5% от денежной оплаты заказного изделия.", fontSize = 12.sp, color = UtpMuted, lineHeight = 18.sp)
                Text("• В игре за пройденный уровень начисляется 10 баллов; их нужно забрать в игре.", fontSize = 12.sp, color = UtpMuted, lineHeight = 18.sp)
                Text("• В завершённом ремонте с неоплаченным чеком администратор может списать до 30% стоимости услуг. Запчасти, товары и заказные изделия не оплачиваются баллами.", fontSize = 12.sp, color = UtpMuted, lineHeight = 18.sp)
                Text("• Профилактическая работа подходит, если оформлена в заказе как услуга; действует тот же лимит. Баллы не обналичиваются, не переводятся и не выводятся.", fontSize = 12.sp, color = UtpMuted, lineHeight = 18.sp)
            }
        }
        if (referralProgram.referralCode.isNotBlank()) {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Пригласите друга", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(
                        "После завершения первого ремонта и подтверждения оплаты сервисом вам обоим начислят по 100 бонусных баллов. Это баллы для скидки, не деньги для вывода.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        lineHeight = 18.sp,
                    )
                    Text("Ваш код: ${referralProgram.referralCode}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
                    Text(
                        "Приглашено: ${referralProgram.totalInvites} · ожидают оплаты: ${referralProgram.pendingCount} · награда получена: ${referralProgram.rewardedCount}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        lineHeight = 18.sp,
                    )
                    Button(
                        onClick = {
                            val inviteLink = "https://task.app.amazi.pro/login?ref=${referralProgram.referralCode}"
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "Приглашение в UTP Servise")
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "Приглашаю в UTP Servise! Зарегистрируйся по ссылке $inviteLink или введи код ${referralProgram.referralCode}. После завершения первого ремонта и подтверждения оплаты сервисом нам обоим начислят по 100 бонусных баллов.",
                                )
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Пригласить друга"))
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text("Поделиться приглашением")
                    }
                    referralProgram.referrals.take(5).forEach { referral ->
                        val date = runCatching {
                            Instant.parse(referral.createdAt).atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()
                        }.getOrDefault(referral.createdAt.take(10))
                        Text(
                            "$date · ${if (referral.status == "REWARDED") "Награда начислена" else "Ожидает завершения и оплаты первого ремонта"}",
                            fontSize = 11.sp,
                            color = UtpMuted,
                        )
                    }
                }
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
                    Text("${if (entry.points > 0) "+" else ""}${entry.points} баллов", color = if (entry.points >= 0) UtpBlue else androidx.compose.material3.MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
