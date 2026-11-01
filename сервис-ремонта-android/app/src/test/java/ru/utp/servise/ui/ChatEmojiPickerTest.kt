package ru.utp.servise.ui

import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import org.junit.Assert.assertEquals
import org.junit.Test

class ChatEmojiPickerTest {
    @Test
    fun `emoji is inserted at the text cursor`() {
        val draft = TextFieldValue("Привет", selection = TextRange(3))

        val result = insertChatEmoji(draft, "😊")

        assertEquals("При😊вет", result.text)
        assertEquals(5, result.selection.start)
    }

    @Test
    fun `emoji replaces the selected text`() {
        val draft = TextFieldValue("Привет", selection = TextRange(0, 3))

        val result = insertChatEmoji(draft, "👍")

        assertEquals("👍вет", result.text)
        assertEquals(2, result.selection.start)
    }

    @Test
    fun `emoji is not inserted beyond the chat message limit`() {
        val draft = TextFieldValue("a".repeat(1_999), selection = TextRange(1_999))

        val result = insertChatEmoji(draft, "😊")

        assertEquals(draft, result)
    }
}
