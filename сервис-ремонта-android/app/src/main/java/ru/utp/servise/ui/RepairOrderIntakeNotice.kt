package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun RepairOrderIntakeNotice(
    phoneNumber: String? = null,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4D6)),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text(
                "Приём новых заявок временно приостановлен",
                color = Color(0xFF51370A),
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "Уже созданные заявки и их статусы остаются доступны.",
                color = Color(0xFF725A24),
                fontSize = 13.sp,
                lineHeight = 19.sp,
            )
            phoneNumber?.takeIf(String::isNotBlank)?.let { phone ->
                CompanyCallButton(
                    phone = phone,
                    modifier = Modifier.fillMaxWidth(),
                    label = "Связаться с сервисом: $phone",
                )
            }
        }
    }
}
