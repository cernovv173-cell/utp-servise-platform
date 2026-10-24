package ru.utp.servise.navigation

internal data class WorkspaceDestination(
    val route: String,
    val label: String,
    val icon: String,
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
    val managementRoutes: Set<String> = emptySet(),
) {
    private val primaryRoutes = primaryDestinations.mapTo(mutableSetOf()) { it.route }
    private val sectionRoutes = sectionGroups.flatMapTo(mutableSetOf()) { group ->
        group.destinations.map { it.route }
    }

    fun selectedTabRoute(currentRoute: String?): String? {
        if (currentRoute == null) return null
        if (currentRoute in primaryRoutes) return currentRoute
        if (sectionHubRoute != null && currentRoute in sectionRoutes) return sectionHubRoute
        if ("admin/manage" in primaryRoutes && currentRoute in managementRoutes) return "admin/manage"
        return null
    }
}

internal fun workspaceNavigationForRole(role: String): WorkspaceNavigation = when (role) {
    "CUSTOMER" -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("customer/home", "Главная", "⌂"),
            WorkspaceDestination("customer/orders", "Заявки", "▤"),
            WorkspaceDestination("customer/devices", "Техника", "▣"),
            WorkspaceDestination("customer/news", "Новости", "▧"),
            WorkspaceDestination("sections", "Разделы", "⋯"),
        ),
        sectionHubRoute = "sections",
        sectionGroups = listOf(
            WorkspaceSectionGroup(
                "Мои ремонты",
                listOf(
                    WorkspaceDestination(
                        "customer/history",
                        "История ремонтов",
                        "◷",
                        "Завершённые и архивные заявки.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Магазин и изделия",
                listOf(
                    WorkspaceDestination(
                        "customer/shop",
                        "Магазин товаров",
                        "🛍",
                        "Товары и статус отдельного заказа.",
                    ),
                    WorkspaceDestination(
                        "customer/crafts",
                        "Ручная работа",
                        "✿",
                        "Готовые изделия и заявки на заказ.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Акции и бонусы",
                listOf(
                    WorkspaceDestination(
                        "customer/offers",
                        "Акции и розыгрыши",
                        "🎁",
                        "Участие в доступных предложениях сервиса.",
                    ),
                    WorkspaceDestination(
                        "customer/loyalty",
                        "Бонусы и приглашения",
                        "★",
                        "Баланс бонусов и статусы приглашённых клиентов.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Информация и помощь",
                listOf(
                    WorkspaceDestination(
                        "customer/about",
                        "О компании",
                        "ℹ",
                        "Контакты, услуги и график работы.",
                    ),
                    WorkspaceDestination(
                        "customer/reviews",
                        "Мои отзывы",
                        "★",
                        "Отзывы, оставленные после завершения ремонта.",
                    ),
                    WorkspaceDestination(
                        "customer/support-chat",
                        "Чат с поддержкой",
                        "✉",
                        "Написать администратору сервиса.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Аккаунт",
                listOf(
                    WorkspaceDestination(
                        "customer/profile",
                        "Личный кабинет",
                        "♙",
                        "Контакты, пароль и настройки уведомлений.",
                    ),
                ),
            ),
        ),
    )

    "TECHNICIAN" -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("technician/jobs", "Заказы", "▤"),
            WorkspaceDestination("technician/history", "История", "◷"),
            WorkspaceDestination("technician/salary", "Зарплата", "₽"),
            WorkspaceDestination("sections", "Разделы", "⋯"),
        ),
        sectionHubRoute = "sections",
        sectionGroups = listOf(
            WorkspaceSectionGroup(
                "Дополнительно",
                listOf(
                    WorkspaceDestination(
                        "technician/reviews",
                        "Отзывы о работе",
                        "★",
                        "Отзывы клиентов о завершённых ремонтах.",
                    ),
                    WorkspaceDestination(
                        "technician/about",
                        "О компании",
                        "ℹ",
                        "Контакты и график сервиса.",
                    ),
                ),
            ),
            WorkspaceSectionGroup(
                "Аккаунт",
                listOf(
                    WorkspaceDestination(
                        "technician/profile",
                        "Профиль",
                        "♙",
                        "Личные данные и настройки входа.",
                    ),
                ),
            ),
        ),
    )

    else -> WorkspaceNavigation(
        primaryDestinations = listOf(
            WorkspaceDestination("admin/orders", "Заявки", "▤"),
            WorkspaceDestination("admin/history", "История", "◷"),
            WorkspaceDestination("admin/manage", "Управление", "⚙"),
            WorkspaceDestination("admin/profile", "Профиль", "♙"),
        ),
        managementRoutes = setOf(
            "admin/salary",
            "admin/overview",
            "admin/schedule",
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
        ),
    )
}
