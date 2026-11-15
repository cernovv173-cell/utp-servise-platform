package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.R
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CompanyInfo
import ru.utp.servise.data.PublicReview

@Composable
fun PublicHomeScreen(
    onBackToStart: () -> Unit,
    onRequest: () -> Unit,
    onCustomerLogin: () -> Unit,
    onTechnicianLogin: () -> Unit,
    onProcurementLogin: () -> Unit,
    onAdminLogin: () -> Unit,
    seasonalTheme: String = "NONE",
) {
    var company by remember { mutableStateOf<CompanyInfo?>(null) }
    var review by remember { mutableStateOf<PublicReview?>(null) }

    LaunchedEffect(Unit) {
        val publicContent = withContext(Dispatchers.IO) {
            runCatching { ApiClient.companyInfo() }.getOrNull() to
                runCatching { ApiClient.publicReviews().firstOrNull() }.getOrNull()
        }
        company = publicContent.first
        review = publicContent.second
    }

    val services = company?.services?.filter(String::isNotBlank)?.take(4).orEmpty().ifEmpty {
        listOf(
            "Диагностика компьютеров и ноутбуков",
            "Ремонт компьютеров и ноутбуков",
            "Настройка и профилактика техники",
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        TextButton(onClick = onBackToStart) { Text("←  Назад к началу") }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                painter = painterResource(R.drawable.utp_servise_logo),
                contentDescription = "Логотип ЕНОТ СЕРВИС",
                modifier = Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)),
            )
            Column(modifier = Modifier.padding(start = 12.dp)) {
                Text(company?.name?.takeIf(String::isNotBlank) ?: "ЕНОТ СЕРВИС", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Сервис ремонта техники", color = UtpMuted, fontSize = 13.sp)
            }
        }

        if (seasonalTheme != "NONE") SeasonalHomeBanner(seasonalTheme)

        Card(colors = CardDefaults.cardColors(containerColor = UtpBlue), shape = RoundedCornerShape(24.dp)) {
            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Ремонт техники — понятно и без лишних шагов.",
                    color = Color.White,
                    fontSize = 27.sp,
                    lineHeight = 33.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    company?.description?.takeIf(String::isNotBlank)
                        ?: "Помогаем вернуть технику к работе и остаёмся на связи на каждом этапе.",
                    color = Color.White.copy(alpha = 0.9f),
                    lineHeight = 22.sp,
                )
                Button(onClick = onRequest, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp)) {
                    Text("Оформить заявку")
                }
                company?.phone?.takeIf(String::isNotBlank)?.let { phone ->
                    CompanyCallButton(
                        phone = phone,
                        modifier = Modifier.fillMaxWidth(),
                        label = "Позвонить $phone",
                    )
                }
                Text("Регистрация понадобится только при оформлении заявки.", color = Color.White.copy(alpha = 0.82f), fontSize = 12.sp)
            }
        }

        CustomerOfferHomeBanners(onOpenOffers = onCustomerLogin)

        Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            PublicSectionTitle("Услуги сервиса")
            services.forEach { service ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text(service, modifier = Modifier.fillMaxWidth().padding(16.dp), fontWeight = FontWeight.Medium, color = UtpInk)
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            PublicSectionTitle("Как проходит ремонт")
            listOf(
                "01  Оставьте заявку и опишите устройство.",
                "02  Получите диагностику и согласуйте работы.",
                "03  Следите за статусом и перепиской в аккаунте.",
            ).forEach { step ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text(step, modifier = Modifier.fillMaxWidth().padding(16.dp), color = UtpInk, lineHeight = 21.sp)
                }
            }
        }

        review?.let { item ->
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                PublicSectionTitle("Отзыв клиента")
                Card(
                    colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            repeat(item.rating.coerceIn(0, 5)) {
                                Icon(Icons.Filled.Star, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(18.dp))
                            }
                            Text("${item.rating}/5", color = UtpMuted, fontSize = 12.sp, modifier = Modifier.padding(start = 5.dp))
                        }
                        Text(item.comment, color = UtpInk, lineHeight = 21.sp)
                        Text(
                            listOf(item.customerName, item.deviceType.takeIf(String::isNotBlank), item.createdAt.take(10))
                                .filterNotNull().filter(String::isNotBlank).joinToString(" · "),
                            color = UtpMuted,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PublicSectionTitle("Контакты и вход")
                company?.phone?.takeIf(String::isNotBlank)?.let { Text("Телефон: $it", color = UtpInk) }
                company?.email?.takeIf(String::isNotBlank)?.let { Text("Почта: $it", color = UtpInk) }
                company?.address?.takeIf(String::isNotBlank)?.let { Text("Адрес: $it", color = UtpInk) }
                company?.hours?.takeIf(String::isNotBlank)?.let { Text("График: $it", color = UtpMuted, fontSize = 13.sp) }
                OutlinedButton(onClick = onCustomerLogin, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) {
                    Text("Войти в аккаунт клиента")
                }
                Text("Вход для сотрудников", fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.padding(top = 4.dp))
                OutlinedButton(onClick = onTechnicianLogin, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) {
                    Text("Вход для мастера")
                }
                OutlinedButton(onClick = onProcurementLogin, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) {
                    Text("Вход для закупки")
                }
                OutlinedButton(onClick = onAdminLogin, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) {
                    Text("Вход администратора")
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun PublicSectionTitle(title: String) {
    Text(title, fontSize = 21.sp, fontWeight = FontWeight.Bold, color = UtpInk)
}
