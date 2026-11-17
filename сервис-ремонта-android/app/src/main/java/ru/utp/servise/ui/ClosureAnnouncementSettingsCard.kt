package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.utp.servise.data.ClosureAnnouncementSettings

@Composable
internal fun ClosureAnnouncementSettingsCard(
    settings: ClosureAnnouncementSettings?,
    loadFailed: Boolean,
    saving: Boolean,
    onSettingsChanged: (ClosureAnnouncementSettings) -> Unit,
    onRetry: () -> Unit,
    onSave: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Объявление о перерыве в работе", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Настройте объявление, которое появится на сайте и в приложении в заданный период.",
                color = UtpMuted,
                style = MaterialTheme.typography.bodySmall,
            )
            if (loadFailed) {
                Text(
                    "Не удалось загрузить настройку.",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                    Text("Повторить загрузку")
                }
            } else if (settings == null) {
                Text("Загружаем настройки…", color = UtpMuted)
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Показывать объявление", modifier = Modifier.weight(1f), color = UtpInk)
                    Switch(
                        checked = settings.enabled,
                        onCheckedChange = { onSettingsChanged(settings.copy(enabled = it)) },
                        enabled = !saving,
                    )
                }
                OutlinedTextField(
                    value = settings.title,
                    onValueChange = { onSettingsChanged(settings.copy(title = it)) },
                    label = { Text("Заголовок") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !saving,
                )
                OutlinedTextField(
                    value = settings.message,
                    onValueChange = { onSettingsChanged(settings.copy(message = it)) },
                    label = { Text("Основной текст") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !saving,
                    minLines = 2,
                )
                OutlinedTextField(
                    value = settings.startDate,
                    onValueChange = { onSettingsChanged(settings.copy(startDate = it)) },
                    label = { Text("Первый день закрытия (ГГГГ-ММ-ДД)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !saving,
                )
                OutlinedTextField(
                    value = settings.endDate,
                    onValueChange = { onSettingsChanged(settings.copy(endDate = it)) },
                    label = { Text("Последний день закрытия, включительно") },
                    supportingText = { Text("Формат даты: ГГГГ-ММ-ДД") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !saving,
                )
                OutlinedTextField(
                    value = settings.reopenTime,
                    onValueChange = { onSettingsChanged(settings.copy(reopenTime = it)) },
                    label = { Text("Время открытия по Москве (ЧЧ:ММ)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !saving,
                )
                OutlinedTextField(
                    value = settings.phoneNumber,
                    onValueChange = { onSettingsChanged(settings.copy(phoneNumber = it)) },
                    label = { Text("Телефон для срочных заказов") },
                    supportingText = { Text("Оставьте пустым, чтобы использовать телефон компании") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !saving,
                )
                Text(
                    "Этот переключатель управляет только объявлением. Приём заявок на ремонт меняется отдельно.",
                    color = UtpMuted,
                    style = MaterialTheme.typography.bodySmall,
                )
                Button(
                    onClick = onSave,
                    enabled = !saving && settings.title.isNotBlank() && settings.message.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (saving) "Сохраняем…" else "Сохранить объявление")
                }
            }
        }
    }
}
