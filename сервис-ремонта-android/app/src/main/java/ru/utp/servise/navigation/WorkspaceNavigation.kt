package ru.utp.servise.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.graphics.vector.ImageVector

internal data class WorkspaceDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val description: String = "",
)

internal data class WorkspaceSectionGroup(
    val title: String,
    val destinations: List<WorkspaceDestination>,
)

internal data class WorkspaceNavigation(
    val primaryDestinations: List<WorkspaceDestination>,
    val sectionGroups: List<WorkspaceSectionGroup> = emptyList(),
    val sectionHubRoute: String? = null,
    val sectionParentRoute: String? = null,
    val managementRoutes: Set<String> = emptySet(),
) {
    private val primaryRoutes = primaryDestinations.mapTo(mutableSetOf()) { it.route }
    private val sectionRoutes = sectionGroups.flatMapTo(mutableSetOf()) { group ->
        group.destinations.map { it.route }
    }

    fun selectedTabRoute(currentRoute: String?): String? {
        if (currentRoute == null) return null
        if (currentRoute in primaryRoutes) return currentRoute
        val isSectionRoute = sectionRoutes.any { route ->
            currentRoute == route || currentRoute.startsWith("$route/")
        }
        if (sectionParentRoute != null && (currentRoute == sectionHubRoute || isSectionRoute)) {
            return sectionParentRoute
        }
        if ("admin/manage" in primaryRoutes && currentRoute in managementRoutes) return "admin/manage"
        return null
    }
}

internal fun workspaceNavigationForRole(role: String): WorkspaceNavigation = when (role) {
    "CUSTOMER" -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("customer/home", "Главная", Icons.Filled.Home),
            WorkspaceDestination("customer/orders", "Ремонты", Icons.AutoMirrored.Filled.List),
            WorkspaceDestination("customer/shop", "Магазин", Icons.Filled.ShoppingCart),
            WorkspaceDestination("customer/loyalty", "Бонусы", Icons.Filled.Star),
            WorkspaceDestination("customer/profile", "Профиль", Icons.Filled.Person),
        ),
        sectionHubRoute = "sections",
        sectionParentRoute = "customer/profile",
        sectionGroups = listOf(
            WorkspaceSectionGroup(
                "Ремонты и техника",
                listOf(
                    WorkspaceDestination(
                        "customer/history",
                        "История ремонтов",
                        Icons.AutoMirrored.Filled.List,
                        "Завершённые и архивные заявки.",
                    ),
                    WorkspaceDestination(
                        "customer/devices",
                        "Моя техника",
                        Icons.Filled.Build,
                        "Сохранённые устройства, напоминания и гарантийные обращения.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Предложения",
                listOf(
                    WorkspaceDestination(
                        "customer/offers",
                        "Акции и розыгрыши",
                        Icons.Filled.Star,
                        "Участие в доступных предложениях сервиса.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Информация и помощь",
                listOf(
                    WorkspaceDestination(
                        "customer/news",
                        "Новости",
                        Icons.Filled.Info,
                        "Объявления сервиса и публикации.",
                    ),
                    WorkspaceDestination(
                        "customer/guides",
                        "Полезные памятки",
                        Icons.Filled.Info,
                        "Советы перед обращением в сервис.",
                    ),
                    WorkspaceDestination(
                        "customer/chats",
                        "Чаты по заявкам",
                        Icons.AutoMirrored.Filled.List,
                        "Переписки по активным и завершённым ремонтам.",
                    ),
                    WorkspaceDestination(
                        "customer/about",
                        "О компании",
                        Icons.Filled.Info,
                        "Контакты, услуги и график работы.",
                    ),
                    WorkspaceDestination(
                        "customer/reviews",
                        "Мои отзывы",
                        Icons.Filled.Star,
                        "Отзывы, оставленные после завершения ремонта.",
                    ),
                    WorkspaceDestination(
                        "customer/support-chat",
                        "Чат с поддержкой",
                        Icons.Filled.Info,
                        "Написать администратору сервиса.",
                    ),
                ),
            ),
        ),
    )

    "TECHNICIAN" -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("technician/jobs", "Заказы", Icons.AutoMirrored.Filled.List),
            WorkspaceDestination("technician/catalog", "Каталог", Icons.Filled.Search),
            WorkspaceDestination("technician/salary", "Зарплата", Icons.Filled.Star),
            WorkspaceDestination("technician/profile", "Профиль", Icons.Filled.Person),
        ),
        sectionHubRoute = "sections",
        sectionParentRoute = "technician/profile",
        sectionGroups = listOf(
            WorkspaceSectionGroup(
                "Дополнительно",
                listOf(
                    WorkspaceDestination(
                        "technician/chats",
                        "Чаты по заявкам",
                        Icons.AutoMirrored.Filled.List,
                        "Переписки по назначенным заказам.",
                    ),
                    WorkspaceDestination(
                        "technician/reviews",
                        "Отзывы о работе",
                        Icons.Filled.Star,
                        "Отзывы клиентов о завершённых ремонтах.",
                    ),
                    WorkspaceDestination(
                        "technician/about",
                        "О компании",
                        Icons.Filled.Info,
                        "Контакты и график сервиса.",
                    ),
                ),
            ),
        ),
    )

    "PROCUREMENT" -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("procurement/home", "Закупки", Icons.Filled.ShoppingCart),
            WorkspaceDestination("procurement/catalog", "Товары", Icons.Filled.Search),
            WorkspaceDestination("procurement/profile", "Профиль", Icons.Filled.Person),
        ),
    )

    else -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("admin/orders", "Заявки", Icons.AutoMirrored.Filled.List),
            WorkspaceDestination("admin/manage", "Управление", Icons.Filled.Settings),
            WorkspaceDestination("admin/seasonal", "Сезоны", Icons.Filled.Star),
            WorkspaceDestination("admin/catalog", "Каталог", Icons.Filled.Search),
            WorkspaceDestination("admin/profile", "Профиль", Icons.Filled.Person),
        ),
        managementRoutes = setOf(
            "admin/salary",
            "admin/overview",
            "admin/schedule",
            "admin/order-chats",
            "admin/procurement",
            "admin/about",
            "admin/crafts",
            "admin/news",
            "admin/catalog",
            "admin/chats",
            "admin/staff",
            "admin/customers",
            "admin/shop-orders",
            "admin/reviews",
            "admin/support-chats",
            "admin/support-chat/{customerId}",
            "admin/offers",
            "admin/banners",
            "admin/loyalty",
        ),
    )
}
