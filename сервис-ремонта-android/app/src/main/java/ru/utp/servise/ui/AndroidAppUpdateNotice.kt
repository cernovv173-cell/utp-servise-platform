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
fun AndroidAppUpdateNotice() {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Text("Проверка обновлений", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "При открытии приложения проверяется новая версия на сайте. Если обновление доступно, появится предложение скачать и установить его; установку нужно подтвердить в Android.",
                modifier = Modifier.padding(top = 5.dp),
                fontSize = 12.sp,
                color = UtpMuted,
            )
        }
    }
}
