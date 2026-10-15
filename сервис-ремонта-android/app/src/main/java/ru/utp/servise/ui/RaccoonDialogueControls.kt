package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun RaccoonDialogueControls(
    dialogue: String,
    voiceEnabled: Boolean,
    speechAvailable: Boolean?,
    isSpeaking: Boolean,
    onVoiceEnabledChange: (Boolean) -> Unit,
    onRepeat: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("🦝 «$dialogue»", fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Switch(checked = voiceEnabled, onCheckedChange = onVoiceEnabledChange)
            Column(Modifier.weight(1f)) {
                Text("Русская озвучка", fontSize = 13.sp, color = UtpInk)
                Text(
                    when {
                        speechAvailable == null -> "Подключаем русский голос…"
                        !speechAvailable -> "Русский голос недоступен на устройстве"
                        isSpeaking -> "Енот говорит…"
                        voiceEnabled -> "Звук включён"
                        else -> "Звук выключен"
                    },
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
            }
            OutlinedButton(onClick = onRepeat, enabled = voiceEnabled && speechAvailable == true) {
                Text("↻ Повторить")
            }
        }
        if (speechAvailable == false) {
            Text(
                "Для озвучки нужен установленный на Android русский голос синтеза речи.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
