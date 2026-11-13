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
        assertEquals(5, administrator.primaryDestinations.size)
        assertEquals(3, procurement.primaryDestinations.size)
        assertEquals(
            listOf("customer/home", "customer/orders", "customer/shop", "customer/loyalty", "customer/profile"),
            customer.primaryDestinations.map { it.route },
        )
        assertEquals(
            listOf("technician/jobs", "technician/catalog", "technician/salary", "technician/profile"),
            technician.primaryDestinations.map { it.route },
        )
        assertFalse(customer.primaryDestinations.any { it.route == "sections" })
        assertFalse(technician.primaryDestinations.any { it.route == "sections" })
        assertTrue(customer.sectionHubRoute == "sections")
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

        assertTrue(customerRoutes.contains("customer/devices"))
        assertTrue(customerRoutes.contains("customer/offers"))
        assertTrue(customerRoutes.contains("customer/news"))
        assertTrue(customerRoutes.contains("customer/guides"))
        assertTrue(customerRoutes.contains("customer/chats"))
        assertTrue(customerRoutes.contains("customer/support-chat"))
        assertFalse(customerRoutes.contains("customer/shop"))
        assertFalse(customerRoutes.contains("customer/loyalty"))
        assertFalse(customerRoutes.contains("customer/profile"))
        assertFalse(customerRoutes.any { it.startsWith("customer/game") })
        assertFalse(customerRoutes.contains("technician/profile"))
        assertFalse(technicianRoutes.contains("technician/profile"))
        assertTrue(workspaceNavigationForRole("TECHNICIAN").primaryDestinations.any { it.route == "technician/profile" })
        assertFalse(technicianRoutes.contains("customer/shop"))
        assertTrue(technicianRoutes.contains("technician/chats"))
    }

    @Test
    fun `bottom navigation remains available within section and management pages`() {
        val customer = workspaceNavigationForRole("CUSTOMER")
        val technician = workspaceNavigationForRole("TECHNICIAN")
        val administrator = workspaceNavigationForRole("ADMIN")

        assertEquals("customer/profile", customer.selectedTabRoute("customer/history"))
        assertEquals("customer/shop", customer.selectedTabRoute("customer/shop/item/product/123"))
        assertEquals("customer/shop", customer.selectedTabRoute("customer/shop/cart"))
        assertEquals("customer/profile", customer.selectedTabRoute("customer/guides/prepare-laptop"))
        assertEquals("customer/profile", customer.selectedTabRoute("customer/chats"))
        assertEquals("customer/profile", customer.selectedTabRoute("sections"))
        assertEquals("technician/profile", technician.selectedTabRoute("technician/reviews"))
        assertEquals("technician/catalog", technician.selectedTabRoute("technician/catalog"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/schedule"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/order-chats"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/offers"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/banners"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/loyalty"))
        assertEquals("admin/catalog", administrator.selectedTabRoute("admin/catalog"))
        assertEquals(null, customer.selectedTabRoute("customer/new-order"))
        assertEquals("admin/seasonal", administrator.selectedTabRoute("admin/seasonal"))
        assertEquals(null, administrator.selectedTabRoute("admin/new-order"))
    }
}
