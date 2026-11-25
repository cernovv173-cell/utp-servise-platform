package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthStartScreensTest {
    @Test
    fun `staff role selector includes only technician procurement and admin`() {
        val portals = staffLoginPortalOptions.map(LoginPortalOption::portal)

        assertEquals(listOf("TECHNICIAN", "PROCUREMENT", "ADMIN"), portals)
        assertEquals(portals.size, portals.distinct().size)
    }

    @Test
    fun `customer login remains a separate option`() {
        val customer = customerLoginPortalOption

        assertEquals("CUSTOMER", customer.portal)
        assertTrue(customer.title.contains("клиент", ignoreCase = true))
    }
}
