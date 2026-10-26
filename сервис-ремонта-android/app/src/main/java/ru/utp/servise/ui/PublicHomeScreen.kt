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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import ru.utp.servise.R
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CompanyInfo
import ru.utp.servise.data.TechnologyFact

@Composable
fun PublicHomeScreen(
    onRequest: () -> Unit,
    onCustomerLogin: () -> Unit,
    onTechnicianLogin: () -> Unit,
    onProcurementLogin: () -> Unit,
    onAdminLogin: () -> Unit,
) {
    var company by remember { mutableStateOf<CompanyInfo?>(null) }
    var technologyFact by remember { mutableStateOf<TechnologyFact?>(null) }
    LaunchedEffect(Unit) {
        company = runCatching { withContext(Dispatchers.IO) { ApiClient.companyInfo() } }.getOrNull()
    }
    LaunchedEffect(Unit) {
        while (true) {
            technologyFact = runCatching {
                withContext(Dispatchers.IO) { ApiClient.publicTechnologyFact() }
            }.getOrNull()
            val delayUntilUpdate = runCatching {
                technologyFact?.nextUpdateAt?.let {
                    java.time.Instant.parse(it).toEpochMilli() - System.currentTimeMillis()
                } ?: 60_000L
            }.getOrDefault(60_000L).coerceAtLeast(1_000L)
            delay(delayUntilUpdate)
        }
    }

    val services = company?.services?.takeIf { it.isNotEmpty() } ?: listOf(
        "Диагностика компьютеров и ноутбуков",
        "Ремонт компьютеров, ноутбуков, телефонов и планшетов",
        "Настройка, профилактика и замена комплектующих",
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                painter = painterResource(R.drawable.utp_servise_logo),
                contentDescription = "Логотип UTP Servise",
                modifier = Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)),
            )
            Column(modifier = Modifier.padding(start = 12.dp)) {
                Text("UTP Servise", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Сервис ремонта техники", color = UtpMuted, fontSize = 13.sp)
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = UtpBlue),
            shape = RoundedCornerShape(26.dp),
        ) {
            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Ремонт техники — понятно и без лишних шагов.",
                    color = androidx.compose.ui.graphics.Color.White,
                    fontSize = 28.sp,
                    lineHeight = 34.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    company?.description?.takeIf { it.isNotBlank() }
                        ?: "Помогаем вернуть технику к работе, объясняем этапы ремонта и остаёмся на связи.",
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.88f),
                    lineHeight = 22.sp,
                )
                Button(
                    onClick = onRequest,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text("Оформить заявку")
                }
                Text(
                    "Регистрация понадобится только при оформлении заявки.",
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.82f),
                    fontSize = 12.sp,
                )
            }
        }

        technologyFact?.let { TechnologyFactCard(it) }

        OutlinedButton(
            onClick = onCustomerLogin,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(15.dp),
        ) {
            Text("Уже есть аккаунт? Войти")
        }

        PublicSectionTitle("Услуги сервиса")
        services.take(6).forEach { service ->
            Card(
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
            ) {
                Text(service, modifier = Modifier.padding(16.dp), fontWeight = FontWeight.Medium, color = UtpInk)
            }
        }

        PublicSectionTitle("Как всё проходит")
        listOf(
            "01  Оставьте заявку — опишите устройство и неисправность.",
            "02  Получите диагностику и согласуйте дальнейшие работы.",
            "03  Следите за статусом ремонта и перепиской в аккаунте.",
        ).forEach { step ->
            Card(
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
            ) {
                Text(step, modifier = Modifier.padding(16.dp), color = UtpInk, lineHeight = 21.sp)
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)),
            shape = RoundedCornerShape(18.dp),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Вход для сотрудников", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Роли сотрудников выдаёт сервис.", color = UtpMuted, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = onTechnicianLogin, modifier = Modifier.weight(1f), shape = RoundedCornerShape(13.dp)) {
                        Text("Мастер", fontSize = 12.sp)
                    }
                    OutlinedButton(onClick = onProcurementLogin, modifier = Modifier.weight(1f), shape = RoundedCornerShape(13.dp)) {
                        Text("Мастер закупки", fontSize = 11.sp, lineHeight = 13.sp)
                    }
                    OutlinedButton(onClick = onAdminLogin, modifier = Modifier.weight(1f), shape = RoundedCornerShape(13.dp)) {
                        Text("Администратор", fontSize = 11.sp, lineHeight = 13.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun PublicSectionTitle(title: String) {
    Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UtpInk)
}
