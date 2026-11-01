package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private const val MAX_CHAT_MESSAGE_LENGTH = 2_000

private val chatQuickEmojis = listOf(
    "😀", "😃", "😄", "😁", "😅", "😂", "🙂", "😉", "😊", "😍",
    "🥰", "😎", "🤔", "😮", "😢", "🙏", "👍", "👎", "❤️", "🔥", "🎉",
)

internal fun limitChatDraft(value: TextFieldValue): TextFieldValue {
    val text = value.text.take(MAX_CHAT_MESSAGE_LENGTH)
    if (text.length == value.text.length) return value
    val start = value.selection.start.coerceIn(0, text.length)
    val end = value.selection.end.coerceIn(0, text.length)
    return value.copy(text = text, selection = TextRange(start, end))
}

internal fun insertChatEmoji(value: TextFieldValue, emoji: String): TextFieldValue {
    val selectionStart = minOf(value.selection.start, value.selection.end)
        .coerceIn(0, value.text.length)
    val selectionEnd = maxOf(value.selection.start, value.selection.end)
        .coerceIn(0, value.text.length)
    val nextLength = value.text.length - (selectionEnd - selectionStart) + emoji.length
    if (nextLength > MAX_CHAT_MESSAGE_LENGTH) return value

    val nextText = value.text.replaceRange(selectionStart, selectionEnd, emoji)
    val cursor = selectionStart + emoji.length
    return value.copy(text = nextText, selection = TextRange(cursor))
}

@Composable
internal fun ChatEmojiToggleButton(expanded: Boolean, onClick: () -> Unit) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.semantics {
            contentDescription = if (expanded) "Скрыть смайлики" else "Показать смайлики"
        },
    ) {
        Text("😊", fontSize = 20.sp)
    }
}

@Composable
internal fun ChatEmojiPicker(
    visible: Boolean,
    onEmojiSelected: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!visible) return

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Смайлики",
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                    modifier = Modifier.padding(top = 12.dp),
                )
                TextButton(onClick = onDismiss) { Text("Закрыть") }
            }
            LazyRow(
                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                items(chatQuickEmojis) { emoji ->
                    TextButton(
                        onClick = { onEmojiSelected(emoji) },
                        modifier = Modifier.semantics { contentDescription = "Вставить $emoji" },
                    ) {
                        Text(emoji, fontSize = 24.sp)
                    }
                }
            }
        }
    }
}
