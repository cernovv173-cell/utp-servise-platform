package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthStartScreensTest {
    @Test
    fun `login screen has only customer and staff portals`() {
        val portals = loginPortalOptions.map(LoginPortalOption::portal)

        assertEquals(listOf("CUSTOMER", "STAFF"), portals)
        assertEquals(portals.size, portals.distinct().size)
    }

    @Test
    fun `staff entry is labelled administrator and explains account-based routing`() {
        assertEquals("STAFF", staffLoginPortalOption.portal)
        assertTrue(staffLoginPortalOption.title.contains("администратор", ignoreCase = true))
        assertTrue(staffLoginPortalOption.description.contains("учётной записи", ignoreCase = true))
    }

    @Test
    fun `customer login remains a separate option`() {
        assertEquals("CUSTOMER", customerLoginPortalOption.portal)
        assertTrue(customerLoginPortalOption.title.contains("клиент", ignoreCase = true))
    }
}
