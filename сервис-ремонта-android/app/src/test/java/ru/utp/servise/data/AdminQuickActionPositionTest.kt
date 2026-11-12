package ru.utp.servise.data

import org.junit.Assert.assertEquals
import org.junit.Test

class AdminQuickActionPositionTest {
    @Test
    fun `drag updates normalized position and clamps it to the screen`() {
        val moved = AdminQuickActionPosition(0.8f, 0.2f).draggedBy(
            deltaX = 50f,
            deltaY = -80f,
            maxX = 100f,
            maxY = 200f,
        )

        assertEquals(1f, moved.xFraction)
        assertEquals(0f, moved.yFraction)
    }

    @Test
    fun `position stays unchanged when an axis has no available movement`() {
        val moved = AdminQuickActionPosition(0.4f, 0.7f).draggedBy(
            deltaX = 20f,
            deltaY = -20f,
            maxX = 0f,
            maxY = 0f,
        )

        assertEquals(0.4f, moved.xFraction)
        assertEquals(0.7f, moved.yFraction)
    }
}
