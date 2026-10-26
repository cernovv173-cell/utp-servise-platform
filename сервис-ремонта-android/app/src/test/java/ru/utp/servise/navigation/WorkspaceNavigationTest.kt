package ru.utp.servise.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkspaceNavigationTest {
    @Test
    fun `primary navigation stays within a compact role-specific limit`() {
        val customer = workspaceNavigationForRole("CUSTOMER")
        val technician = workspaceNavigationForRole("TECHNICIAN")
        val administrator = workspaceNavigationForRole("ADMIN")
        val procurement = workspaceNavigationForRole("PROCUREMENT")

        assertEquals(5, customer.primaryDestinations.size)
        assertEquals(4, technician.primaryDestinations.size)
        assertEquals(4, administrator.primaryDestinations.size)
        assertEquals(3, procurement.primaryDestinations.size)
        assertTrue(customer.primaryDestinations.any { it.route == "sections" })
        assertTrue(technician.primaryDestinations.any { it.route == "sections" })
    }

    @Test
    fun `procurement navigation exposes only inventory and profile screens`() {
        val procurement = workspaceNavigationForRole("PROCUREMENT")
        val routes = procurement.primaryDestinations.map { it.route }

        assertEquals(
            listOf("procurement/home", "procurement/catalog", "procurement/profile"),
            routes,
        )
        assertFalse(routes.any { it.startsWith("admin/") || it.startsWith("technician/") })
    }

    @Test
    fun `customer and technician section lists retain only their own screens`() {
        val customerRoutes = workspaceNavigationForRole("CUSTOMER")
            .sectionGroups.flatMap { group -> group.destinations.map { it.route } }
        val technicianRoutes = workspaceNavigationForRole("TECHNICIAN")
            .sectionGroups.flatMap { group -> group.destinations.map { it.route } }

        assertTrue(customerRoutes.contains("customer/shop"))
        assertTrue(customerRoutes.contains("customer/support-chat"))
        assertFalse(customerRoutes.any { it.startsWith("customer/game") })
        assertFalse(customerRoutes.contains("technician/profile"))
        assertTrue(technicianRoutes.contains("technician/profile"))
        assertFalse(technicianRoutes.contains("customer/shop"))
    }

    @Test
    fun `bottom navigation remains available within section and management pages`() {
        val customer = workspaceNavigationForRole("CUSTOMER")
        val technician = workspaceNavigationForRole("TECHNICIAN")
        val administrator = workspaceNavigationForRole("ADMIN")

        assertEquals("sections", customer.selectedTabRoute("customer/loyalty"))
        assertEquals("sections", technician.selectedTabRoute("technician/reviews"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/schedule"))
        assertEquals(null, customer.selectedTabRoute("customer/new-order"))
        assertEquals(null, administrator.selectedTabRoute("admin/new-order"))
    }
}
