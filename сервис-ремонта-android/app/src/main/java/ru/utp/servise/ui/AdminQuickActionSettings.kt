package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun AdminQuickActionSettings(
    visible: Boolean,
    onVisibilityChanged: (Boolean) -> Unit,
    onResetPosition: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Кнопка «Старт / Стоп»", fontWeight = FontWeight.SemiBold)
            Text(
                text = if (visible) {
                    "Удерживайте кнопку на экране, чтобы перетащить её. Положение сохранится на этом устройстве."
                } else {
                    "Кнопка скрыта. Её можно снова включить здесь."
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(2.dp))
            OutlinedButton(
                onClick = { onVisibilityChanged(!visible) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (visible) "Скрыть кнопку" else "Показать кнопку")
            }
            TextButton(
                onClick = onResetPosition,
                modifier = Modifier.align(Alignment.End),
            ) {
                Text("Вернуть в правый нижний угол")
            }
        }
    }
}
