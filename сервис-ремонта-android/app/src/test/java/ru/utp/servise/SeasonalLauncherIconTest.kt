package ru.utp.servise

import org.junit.Assert.assertEquals
import org.junit.Test

class SeasonalLauncherIconTest {
    @Test
    fun mapsEachSeasonToItsLauncherAlias() {
        assertEquals("LauncherSpring", launcherAliasForSeason("SPRING"))
        assertEquals("LauncherSummer", launcherAliasForSeason("SUMMER"))
        assertEquals("LauncherAutumn", launcherAliasForSeason("AUTUMN"))
        assertEquals("LauncherWinter", launcherAliasForSeason("WINTER"))
    }

    @Test
    fun usesTheBaseIconWhenSeasonalStylingIsDisabledOrUnknown() {
        assertEquals("LauncherDefault", launcherAliasForSeason("NONE"))
        assertEquals("LauncherDefault", launcherAliasForSeason("unknown"))
    }
}
