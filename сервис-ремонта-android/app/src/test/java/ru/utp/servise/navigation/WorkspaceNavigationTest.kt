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
        assertEquals(5, technician.primaryDestinations.size)
        assertEquals(4, administrator.primaryDestinations.size)
        assertEquals(3, procurement.primaryDestinations.size)
        assertEquals(
            listOf("customer/home", "customer/orders", "customer/shop", "customer/chats", "customer/profile"),
            customer.primaryDestinations.map { it.route },
        )
        assertEquals("Чат", customer.primaryDestinations[3].label)
        assertEquals(
            listOf("technician/home", "technician/jobs", "technician/catalog", "technician/salary", "technician/profile"),
            technician.primaryDestinations.map { it.route },
        )
        assertEquals(
            listOf("admin/home", "admin/orders", "admin/manage", "admin/profile"),
            administrator.primaryDestinations.map { it.route },
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
        assertEquals("sections", procurement.sectionHubRoute)
        assertEquals("Склад", procurement.primaryDestinations.first().label)
        val sectionRoutes = procurement.sectionGroups.flatMap { it.destinations }.map { it.route }
        assertTrue(sectionRoutes.any { it == "app/version" })
        assertTrue(sectionRoutes.all { it == "procurement/profile" || it == "app/version" })
    }

    @Test
    fun `staff navigation contains only modules granted by saved permissions`() {
        val staff = workspaceNavigationForUser("STAFF", setOf("inventory", "communications"))
        val routes = staff.sectionGroups.flatMap { it.destinations }.map { it.route }

        assertEquals(listOf("admin/profile"), staff.primaryDestinations.map { it.route })
        assertEquals("sections", staff.sectionHubRoute)
        assertEquals("admin/profile", staff.sectionParentRoute)
        assertTrue(routes.contains("admin/procurement"))
        assertTrue(routes.contains("admin/catalog"))
        assertTrue(routes.contains("admin/chats"))
        assertTrue(routes.contains("admin/order-chats"))
        assertFalse(routes.contains("admin/customers"))
        assertFalse(routes.contains("admin/staff"))
        assertFalse(routes.contains("admin/seasonal"))
        assertFalse(routes.any { it.startsWith("technician/") })
    }

    @Test
    fun `staff with repair permission gets assigned jobs without admin navigation`() {
        val staff = workspaceNavigationForUser("STAFF", setOf("repairs"))
        val routes = staff.sectionGroups.flatMap { it.destinations }.map { it.route }

        assertEquals("technician/jobs", staff.primaryDestinations.first().route)
        assertTrue(routes.contains("technician/history"))
        assertTrue(routes.contains("technician/catalog"))
        assertTrue(routes.contains("technician/salary"))
        assertFalse(routes.any { it.startsWith("admin/") })
    }

    @Test
    fun `full administrator retains the existing unrestricted navigation`() {
        val administrator = workspaceNavigationForUser("ADMIN", emptySet())

        assertEquals(
            workspaceNavigationForRole("ADMIN").primaryDestinations.map { it.route },
            administrator.primaryDestinations.map { it.route },
        )
        assertTrue(administrator.sectionGroups.flatMap { it.destinations }.any { it.route == "admin/staff" })
    }

    @Test
    fun `all authenticated roles have a secondary sections hub`() {
        listOf("CUSTOMER", "TECHNICIAN", "PROCUREMENT", "ADMIN").forEach { role ->
            val navigation = workspaceNavigationForRole(role)
            assertEquals(role, "sections", navigation.sectionHubRoute)
            assertTrue(navigation.sectionGroups.isNotEmpty())
        }

        val adminRoutes = workspaceNavigationForRole("ADMIN")
            .sectionGroups.flatMap { it.destinations }.map { it.route }
        assertTrue(adminRoutes.contains("admin/app-settings"))
        assertTrue(adminRoutes.contains("admin/schedule"))
        assertTrue(adminRoutes.contains("app/version"))
        assertTrue(adminRoutes.all { it.startsWith("admin/") || it == "app/version" })
    }

    @Test
    fun `customer and technician section lists retain only their own screens`() {
        val customerRoutes = workspaceNavigationForRole("CUSTOMER")
            .sectionGroups.flatMap { group -> group.destinations.map { it.route } }
        val technicianRoutes = workspaceNavigationForRole("TECHNICIAN")
            .sectionGroups.flatMap { group -> group.destinations.map { it.route } }

        assertTrue(customerRoutes.contains("customer/devices"))
        assertTrue(customerRoutes.contains("customer/business"))
        assertTrue(customerRoutes.contains("customer/offers"))
        assertTrue(customerRoutes.contains("customer/loyalty"))
        assertTrue(customerRoutes.contains("customer/news"))
        assertTrue(customerRoutes.contains("customer/guides"))
        assertFalse(customerRoutes.contains("customer/chats"))
        assertTrue(customerRoutes.contains("customer/support-chat"))
        assertFalse(customerRoutes.contains("customer/shop"))
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
        val procurement = workspaceNavigationForRole("PROCUREMENT")

        assertEquals("customer/profile", customer.selectedTabRoute("customer/history"))
        assertEquals("customer/profile", customer.selectedTabRoute("customer/business/orders"))
        assertEquals("customer/shop", customer.selectedTabRoute("customer/shop/item/product/123"))
        assertEquals("customer/shop", customer.selectedTabRoute("customer/shop/cart"))
        assertEquals("customer/profile", customer.selectedTabRoute("customer/guides/prepare-laptop"))
        assertEquals("customer/chats", customer.selectedTabRoute("customer/chats"))
        assertEquals("customer/profile", customer.selectedTabRoute("sections"))
        assertEquals("technician/profile", technician.selectedTabRoute("technician/reviews"))
        assertEquals("technician/catalog", technician.selectedTabRoute("technician/catalog"))
        assertEquals("technician/home", technician.selectedTabRoute("technician/home"))
        assertEquals("procurement/profile", procurement.selectedTabRoute("sections"))
        assertEquals("procurement/profile", procurement.selectedTabRoute("app/version"))
        assertEquals("admin/home", administrator.selectedTabRoute("admin/home"))
        assertEquals("admin/manage", administrator.selectedTabRoute("sections"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/schedule"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/order-chats"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/offers"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/banners"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/loyalty"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/app-settings"))
        assertEquals("admin/manage", administrator.selectedTabRoute("app/version"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/catalog"))
        assertEquals("admin/manage", administrator.selectedTabRoute("admin/seasonal"))
        assertEquals(null, customer.selectedTabRoute("customer/new-order"))
        assertEquals(null, administrator.selectedTabRoute("admin/new-order"))
    }
}
