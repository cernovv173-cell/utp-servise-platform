package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthStartScreensTest {
    @Test
    fun `role chooser includes all supported account types once`() {
        val portals = loginPortalOptions.map(LoginPortalOption::portal)

        assertEquals(listOf("CUSTOMER", "TECHNICIAN", "PROCUREMENT", "ADMIN"), portals)
        assertEquals(portals.size, portals.distinct().size)
    }

    @Test
    fun `customer option is presented first in role chooser`() {
        val customer = loginPortalOptions.first()

        assertEquals("CUSTOMER", customer.portal)
        assertTrue(customer.title.contains("клиент", ignoreCase = true))
    }
}
