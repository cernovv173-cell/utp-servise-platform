package ru.utp.servise

import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.ui.CustomerGuideArticleScreen
import ru.utp.servise.ui.CustomerGuidesIndexScreen
import ru.utp.servise.ui.RepairChatInboxScreen

internal fun NavGraphBuilder.registerCustomerHelpRoutes(
    orders: List<RepairOrder>,
    refresh: () -> Unit,
    onOpenChat: (String) -> Unit,
    onOpenGuide: (String) -> Unit,
    onBack: () -> Unit,
) {
    composable("customer/guides") {
        CustomerGuidesIndexScreen(onBack = onBack, onOpenGuide = onOpenGuide)
    }
    composable("customer/guides/{slug}") { entry ->
        CustomerGuideArticleScreen(
            slug = entry.arguments?.getString("slug").orEmpty(),
            onBack = onBack,
        )
    }
    composable("customer/chats") {
        RepairChatInboxScreen(
            orders = orders,
            role = "CUSTOMER",
            onRefresh = refresh,
            onOpenChat = onOpenChat,
            onBack = onBack,
        )
    }
}

internal fun NavGraphBuilder.registerTechnicianChatRoute(
    orders: List<RepairOrder>,
    refresh: () -> Unit,
    onOpenChat: (String) -> Unit,
    onBack: () -> Unit,
) {
    composable("technician/chats") {
        RepairChatInboxScreen(
            orders = orders,
            role = "TECHNICIAN",
            onRefresh = refresh,
            onOpenChat = onOpenChat,
            onBack = onBack,
        )
    }
}

internal fun NavGraphBuilder.registerAdminOrderChatsRoute(
    orders: List<RepairOrder>,
    refresh: () -> Unit,
    onOpenChat: (String) -> Unit,
    onBack: () -> Unit,
) {
    composable("admin/order-chats") {
        RepairChatInboxScreen(
            orders = orders,
            role = "ADMIN",
            onRefresh = refresh,
            onOpenChat = onOpenChat,
            onBack = onBack,
        )
    }
}
