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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CatalogVisibilitySettings

@Composable
internal fun CatalogVisibilitySettingsCard(
    settings: CatalogVisibilitySettings?,
    loadFailed: Boolean,
    saving: Boolean,
    onRetry: () -> Unit,
    onSettingsChanged: (CatalogVisibilitySettings) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Каталог для клиентов", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Временно скрывайте услуги и обычные товары на сайте и в приложении. Позиции каталога и история заказов сохраняются.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            CatalogVisibilitySwitchRow(
                title = "Каталог услуг и цены",
                description = "Показывать прайс на сайте и в клиентской части приложения.",
                checked = settings?.servicesVisible == true,
                enabled = settings != null && !saving && !loadFailed,
                onCheckedChange = { enabled ->
                    settings?.let { onSettingsChanged(it.copy(servicesVisible = enabled)) }
                },
            )
            CatalogVisibilitySwitchRow(
                title = "Обычные товары в магазине",
                description = "Изделия ручной работы управляются отдельно.",
                checked = settings?.productsVisible == true,
                enabled = settings != null && !saving && !loadFailed,
                onCheckedChange = { enabled ->
                    settings?.let { onSettingsChanged(it.copy(productsVisible = enabled)) }
                },
            )
            Text(
                "Запчасти в сметах и актах остаются видимыми. Уже оформленные заказы не меняются.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            when {
                loadFailed -> {
                    Text(
                        "Не удалось загрузить настройки каталога.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                        Text("Повторить загрузку")
                    }
                }
                settings == null -> Text("Загружаем настройки…", fontSize = 12.sp, color = UtpMuted)
                saving -> Text("Сохраняем…", fontSize = 12.sp, color = UtpMuted)
                else -> Text("Изменения сохраняются сразу после переключения.", fontSize = 12.sp, color = UtpMuted)
            }
        }
    }
}

@Composable
private fun CatalogVisibilitySwitchRow(
    title: String,
    description: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(title, fontWeight = FontWeight.Medium, color = UtpInk)
            Text(description, fontSize = 12.sp, color = UtpMuted)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
        )
    }
}
