package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class TechnicianNameFormatterTest {
    @Test
    fun `keeps the first part and shortens remaining parts to initials`() {
        assertEquals("Иванов И. И.", "Иванов Иван Иванович".shortTechnicianName())
    }

    @Test
    fun `does not duplicate punctuation for an existing initial`() {
        assertEquals("Иванов И.", "Иванов И.".shortTechnicianName())
    }

    @Test
    fun `normalizes whitespace and preserves a single name`() {
        assertEquals("Александр", "  Александр  ".shortTechnicianName())
        assertEquals("Иванов П.", "Иванов   Пётр".shortTechnicianName())
    }
}
