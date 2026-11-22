package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CustomerBusinessProfile

@Composable
fun CustomerBusinessHomeScreen(
    profile: CustomerBusinessProfile?,
    deviceCount: Int,
    orderCount: Int,
    busy: Boolean,
    onBack: () -> Unit,
    onSaveProfile: (String) -> Unit,
    onOpenDevices: () -> Unit,
    onOpenOrders: () -> Unit,
    onNewOrder: () -> Unit,
) {
    var companyName by remember(profile?.id, profile?.companyName) {
        mutableStateOf(profile?.companyName.orEmpty())
    }
    val hasProfile = profile != null

    Column(
        Modifier.fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onBack) { Text("← Назад") }
        Text("Корпоративный кабинет", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "Техника компании, новые обращения и история ремонта собраны отдельно от личного раздела.",
            fontSize = 13.sp,
            color = UtpMuted,
        )
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("Профиль компании", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(
                    "Кабинет привязан к вашему клиентскому аккаунту. Доступ сотрудников и отдельные роли пока не подключены.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
                OutlinedTextField(
                    value = companyName,
                    onValueChange = { companyName = it.take(160) },
                    label = { Text("Название организации") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                )
                Button(
                    enabled = !busy && companyName.trim().length >= 2,
                    onClick = { onSaveProfile(companyName.trim()) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(if (busy) "Сохраняем…" else if (hasProfile) "Сохранить название" else "Создать профиль")
                }
            }
        }
        Text(
            "Название используется для группировки новых устройств и обращений; оно не подтверждает юридический статус организации. Старые личные заявки не переносятся автоматически.",
            fontSize = 12.sp,
            color = UtpMuted,
        )
        if (hasProfile) {
            OutlinedButton(
                enabled = !busy,
                onClick = onOpenDevices,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text("Техника компании · $deviceCount")
            }
            OutlinedButton(
                enabled = !busy,
                onClick = onOpenOrders,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text("Заявки и документы · $orderCount")
            }
            Button(
                enabled = !busy,
                onClick = onNewOrder,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text("Создать заявку компании")
            }
        } else {
            Text(
                "После создания профиля появятся отдельные списки устройств и ремонтов компании.",
                fontSize = 13.sp,
                color = UtpMuted,
            )
        }
    }
}
