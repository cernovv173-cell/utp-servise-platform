package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class FlowingFirePaletteTest {
    @Test
    fun exposesTheSameSixPalettesAsTheWebAdmin() {
        assertEquals(
            listOf("EMBER", "CYAN", "VIOLET", "ROSE", "EMERALD", "GOLD"),
            flowingFirePaletteOptions.map { it.key },
        )
        assertEquals("Янтарный жар", flowingFirePaletteOptions.first().label)
        assertEquals("Ледяной голубой", flowingFirePaletteOptions[1].label)
    }

    @Test
    fun everyPaletteHasAnIndependentBrightColorAndUnknownNamesUseTheDefault() {
        val brightColors = flowingFirePaletteOptions.map { it.colors[1] }
        assertEquals(flowingFirePaletteOptions.size, brightColors.distinct().size)
        assertNotEquals(
            flowingFirePaletteColors("EMBER"),
            flowingFirePaletteColors("CYAN"),
        )
        assertEquals(
            flowingFirePaletteColors("EMBER"),
            flowingFirePaletteColors("UNKNOWN"),
        )
    }
}
