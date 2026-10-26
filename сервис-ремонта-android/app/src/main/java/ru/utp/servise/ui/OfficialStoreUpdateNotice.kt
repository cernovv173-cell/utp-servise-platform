package ru.utp.servise.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun OfficialStoreUpdateNotice() {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Text("Обновление приложения", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Для безопасности устанавливайте обновления через официальный магазин, из которого вы скачали приложение.",
                modifier = Modifier.padding(top = 5.dp),
                fontSize = 12.sp,
                color = UtpMuted,
            )
        }
    }
}
