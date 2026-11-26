package ru.utp.servise.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star

internal fun workspaceNavigationForUser(role: String, permissions: Set<String>): WorkspaceNavigation {
    if (role != "STAFF") return workspaceNavigationForRole(role)

    val groups = buildList {
        if ("repairs" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Заявки и ремонт",
                    listOf(
                        WorkspaceDestination("technician/history", "История ремонтов", Icons.AutoMirrored.Filled.List),
                        WorkspaceDestination("technician/catalog", "Каталог услуг", Icons.Filled.Search),
                        WorkspaceDestination("technician/salary", "Мои начисления", Icons.Filled.Star),
                    ),
                ),
            )
        }
        if ("inventory" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Каталог и склад",
                    listOf(
                        WorkspaceDestination("admin/procurement", "Склад", Icons.Filled.ShoppingCart),
                        WorkspaceDestination("admin/catalog", "Каталог товаров и запчастей", Icons.Filled.Search),
                    ),
                ),
            )
        }
        if ("customers" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Клиенты",
                    listOf(WorkspaceDestination("admin/customers", "Клиенты", Icons.Filled.Person)),
                ),
            )
        }
        if ("shop_orders" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Заказы магазина",
                    listOf(
                        WorkspaceDestination("admin/shop-orders", "Заказы магазина", Icons.Filled.ShoppingCart),
                        WorkspaceDestination("admin/crafts", "Изделия и заказы", Icons.Filled.Build),
                    ),
                ),
            )
        }
        if ("communications" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Чаты и поддержка",
                    listOf(
                        WorkspaceDestination("admin/chats", "Чаты поддержки", Icons.Filled.Info),
                        WorkspaceDestination("admin/order-chats", "Чаты по заказам", Icons.AutoMirrored.Filled.List),
                        WorkspaceDestination("admin/support-chats", "Поддержка", Icons.Filled.Info),
                    ),
                ),
            )
        }
        if ("content" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Новости и предложения",
                    listOf(
                        WorkspaceDestination("admin/offers", "Акции и розыгрыши", Icons.Filled.Star),
                        WorkspaceDestination("admin/banners", "Баннеры", Icons.Filled.Info),
                        WorkspaceDestination("admin/news", "Новости", Icons.Filled.Info),
                        WorkspaceDestination("admin/reviews", "Отзывы", Icons.Filled.Star),
                        WorkspaceDestination("admin/loyalty", "Бонусная программа", Icons.Filled.Star),
                    ),
                ),
            )
        }
        if ("reports" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Расписание и отчёты",
                    listOf(
                        WorkspaceDestination("admin/overview", "Обзор сервиса", Icons.Filled.Info),
                        WorkspaceDestination("admin/schedule", "Расписание", Icons.AutoMirrored.Filled.List),
                    ),
                ),
            )
        }
        if ("company_settings" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Настройки сервиса",
                    listOf(
                        WorkspaceDestination("admin/about", "О компании", Icons.Filled.Info),
                        WorkspaceDestination("admin/seasonal", "Сезонное оформление", Icons.Filled.Settings),
                        WorkspaceDestination("admin/app-settings", "Настройки приложения", Icons.Filled.Settings),
                    ),
                ),
            )
        }
        if ("staff_management" in permissions) {
            add(
                WorkspaceSectionGroup(
                    "Сотрудники",
                    listOf(WorkspaceDestination("admin/staff", "Сотрудники и доступы", Icons.Filled.Person)),
                ),
            )
        }
    }

    val primaryDestinations = buildList {
        if ("repairs" in permissions) {
            add(WorkspaceDestination("technician/jobs", "Мои заявки", Icons.AutoMirrored.Filled.List))
        }
        add(WorkspaceDestination("admin/profile", "Профиль", Icons.Filled.Person))
    }

    return WorkspaceNavigation(
        primaryDestinations = primaryDestinations,
        sectionHubRoute = "sections",
        sectionParentRoute = if ("repairs" in permissions) "technician/jobs" else "admin/profile",
        sectionGroups = groups,
        managementRoutes = groups.flatMapTo(mutableSetOf()) { group ->
            group.destinations.map { it.route }
        },
    )
}
