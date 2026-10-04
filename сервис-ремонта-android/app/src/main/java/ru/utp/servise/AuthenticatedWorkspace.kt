package ru.utp.servise

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.AdminChatInboxItem
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.AuthResult
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.LoyaltyAccount
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.OrderChat
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.SalarySummary
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.SupportChat
import ru.utp.servise.data.SupportChatInboxItem
import ru.utp.servise.ui.AdminChatInboxScreen
import ru.utp.servise.ui.AdminManagementScreen
import ru.utp.servise.ui.AdminOrderCreationScreen
import ru.utp.servise.ui.CatalogManagementScreen
import ru.utp.servise.ui.CompanyScreen
import ru.utp.servise.ui.CraftsScreen
import ru.utp.servise.ui.CustomerHomeScreen
import ru.utp.servise.ui.CustomerManagementScreen
import ru.utp.servise.ui.LoyaltyScreen
import ru.utp.servise.ui.NewsFeedScreen
import ru.utp.servise.ui.NewsManagementScreen
import ru.utp.servise.ui.ProfileScreen
import ru.utp.servise.ui.RepairChatScreen
import ru.utp.servise.ui.RepairOrdersScreen
import ru.utp.servise.ui.RepairRequestForm
import ru.utp.servise.ui.ReviewFormScreen
import ru.utp.servise.ui.ReviewsScreen
import ru.utp.servise.ui.RunAction
import ru.utp.servise.ui.StaffManagementScreen
import ru.utp.servise.ui.SalaryScreen
import ru.utp.servise.ui.UtpBlue

private data class Destination(val route: String, val label: String, val icon: String)

@Composable
internal fun AuthenticatedWorkspace(
    user: AppUser,
    token: String,
    orders: List<RepairOrder>,
    staff: List<StaffMember>,
    reviews: List<CustomerReview>,
    catalogItems: List<CatalogItem>,
    craftItems: List<CraftItem>,
    craftOrders: List<CraftOrder>,
    news: List<NewsArticle>,
    banners: List<SiteBanner>,
    loyalty: LoyaltyAccount,
    salary: SalarySummary,
    adminChats: List<AdminChatInboxItem>,
    supportChats: List<SupportChatInboxItem>,
    activeChat: OrderChat?,
    onChatUpdated: (OrderChat) -> Unit,
    activeSupportChat: SupportChat?,
    onSupportChatUpdated: (SupportChat) -> Unit,
    onRefreshSupportChat: (String?) -> Unit,
    onRefreshSupportInbox: () -> Unit,
    onUserUpdated: (AppUser) -> Unit,
    onPasswordChanged: (AuthResult) -> Unit,
    busy: Boolean,
    errorMessage: String?,
    onError: (String) -> Unit,
    onDismissError: () -> Unit,
    runAction: RunAction,
    refresh: () -> Unit,
    onLogout: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val onRefreshChat: (String) -> Unit = { orderId ->
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { ApiClient.orderChat(token, orderId) } }
                .onSuccess(onChatUpdated)
                .onFailure { onError(it.message ?: "Не удалось обновить чат.") }
        }
    }
    val destinations = when (user.role) {
        "TECHNICIAN" -> listOf(
            Destination("technician/jobs", "Заказы", "▤"),
            Destination("technician/history", "История", "◷"),
            Destination("technician/salary", "Зарплата", "₽"),
            Destination("technician/reviews", "Отзывы", "★"),
            Destination("technician/about", "О компании", "ℹ"),
            Destination("technician/profile", "Профиль", "♙"),
        )
        "ADMIN" -> listOf(
            Destination("admin/orders", "Заказы", "▤"),
            Destination("admin/history", "История", "◷"),
            Destination("admin/salary", "Зарплата", "₽"),
            Destination("admin/manage", "Управление", "⚙"),
            Destination("admin/profile", "Профиль", "⚙"),
        )
        else -> listOf(
            Destination("customer/home", "Главная", "⌂"),
            Destination("customer/orders", "Заявки", "▤"),
            Destination("customer/history", "История", "◷"),
            Destination("customer/news", "Новости", "▧"),
            Destination("customer/loyalty", "Бонусы", "★"),
            Destination("customer/profile", "Профиль", "♙"),
        )
    }
    val navController = rememberNavController()
    val onCampaignNavigate: (String) -> Unit = { target ->
        val route = when (target.lowercase()) {
            "home" -> "customer/home"
            "news" -> "customer/news"
            "services" -> "customer/about"
            "crafts" -> "customer/crafts"
            "about" -> "customer/about"
            "loyalty" -> "customer/loyalty"
            "checks" -> "customer/orders"
            else -> null
        }
        route?.let { navController.navigate(it) { launchSingleTop = true } }
    }
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val mainRoutes = destinations.map { it.route }

    Scaffold(
        containerColor = androidx.compose.ui.graphics.Color.Transparent,
        bottomBar = {
            if (currentRoute in mainRoutes) {
                NavigationBar {
                    destinations.forEach { destination ->
                        NavigationBarItem(
                            selected = currentRoute == destination.route,
                            onClick = {
                                navController.navigate(destination.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Text(destination.icon) },
                            label = { Text(destination.label, maxLines = 1) },
                        )
                    }
                }
            }
        },
    ) { insets ->
        Column(Modifier.fillMaxSize().padding(insets)) {
            if (errorMessage != null) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 5.dp)) {
                    Text(errorMessage, Modifier.weight(1f), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                    TextButton(onClick = onDismissError) { Text("×") }
                }
            }
            Box(Modifier.weight(1f)) {
                NavHost(navController = navController, startDestination = destinations.first().route, modifier = Modifier.fillMaxSize()) {
                    when (user.role) {
                        "CUSTOMER" -> {
                            composable("customer/home") {
                                CustomerHomeScreen(
                                    user, token, news, banners,
                                    { navController.navigate("customer/new-order") },
                                    { navController.navigate("customer/orders") },
                                    { navController.navigate("customer/crafts") },
                                    { navController.navigate("customer/about") },
                                    { navController.navigate("customer/news") },
                                    { navController.navigate("customer/loyalty") },
                                    onCampaignNavigate,
                                    { navController.navigate("customer/support-chat") },
                                )
                            }
                            composable("customer/news") { NewsFeedScreen(token, news, reviews, banners, onCampaignNavigate) }
                            composable("customer/loyalty") { LoyaltyScreen(loyalty, token, banners, onCampaignNavigate) }
                            composable("customer/about") {
                                CompanyScreen(token, false, busy, runAction, onBack = { navController.popBackStack() }, banners = banners, onCampaignNavigate = onCampaignNavigate)
                            }
                            composable("customer/crafts") { CraftsScreen(token, false, craftItems, craftOrders, runAction, refresh, { navController.popBackStack() }, banners, onCampaignNavigate) }
                            composable("customer/orders") {
                                RepairOrdersScreen("Мои заявки", orders, user.role, token, emptyList(), catalogItems, false, runAction, refresh, loyaltyBalance = loyalty.balance, onChat = { navController.navigate("chat/$it") }, onReview = { id -> navController.navigate("customer/review/$id") })
                            }
                            composable("customer/history") {
                                RepairOrdersScreen("История ремонтов", orders, user.role, token, emptyList(), catalogItems, true, runAction, refresh, loyaltyBalance = loyalty.balance, onChat = { navController.navigate("chat/$it") }, onReview = { id -> navController.navigate("customer/review/$id") })
                            }
                            composable("customer/reviews") { ReviewsScreen("Мои отзывы", reviews, refresh, token = token) }
                            composable("customer/profile") { ProfileScreen(user, token, runAction, onUserUpdated, onPasswordChanged, onLogout) }
                            composable("customer/new-order") {
                                RepairRequestForm(
                                    initialPhone = user.phoneNumber.orEmpty(),
                                    onBack = { navController.popBackStack() },
                                    banners = banners,
                                    token = token,
                                    onCampaignNavigate = onCampaignNavigate,
                                    onSubmit = { device, problem, address ->
                                        runAction({ ApiClient.createOrder(token, device, problem, address) }) { navController.popBackStack() }
                                    },
                                    busy = busy,
                                )
                            }
                            composable("customer/review/{orderId}") { entry ->
                                ReviewFormScreen(entry.arguments?.getString("orderId").orEmpty(), token, runAction) { navController.popBackStack() }
                            }
                        }
                        "TECHNICIAN" -> {
                            composable("technician/jobs") { RepairOrdersScreen("Назначенные заказы", orders, user.role, token, emptyList(), catalogItems, false, runAction, refresh, onChat = { navController.navigate("chat/$it") }, onReview = {}) }
                            composable("technician/history") { RepairOrdersScreen("История ремонтов", orders, user.role, token, emptyList(), catalogItems, true, runAction, refresh, onChat = { navController.navigate("chat/$it") }, onReview = {}) }
                            composable("technician/salary") { SalaryScreen(salary, isAdmin = false, onRefresh = refresh) }
                            composable("technician/reviews") { ReviewsScreen("Отзывы о работе", reviews, refresh, token = token) }
                            composable("technician/about") { CompanyScreen(token, false, busy, runAction, onBack = null, banners = banners, onCampaignNavigate = onCampaignNavigate) }
                            composable("technician/profile") { ProfileScreen(user, token, runAction, onUserUpdated, onPasswordChanged, onLogout) }
                        }
                        else -> {
                            composable("admin/orders") { RepairOrdersScreen("Управление заказами", orders, user.role, token, staff, catalogItems, false, runAction, refresh, onReview = {}, onCreateOrder = { navController.navigate("admin/new-order") }) }
                            composable("admin/history") { RepairOrdersScreen("История ремонтов", orders, user.role, token, staff, catalogItems, true, runAction, refresh, onReview = {}) }
                            composable("admin/new-order") {
                                AdminOrderCreationScreen(
                                    token = token,
                                    busy = busy,
                                    runAction = runAction,
                                    onBack = { navController.popBackStack() },
                                    onCreated = { refresh(); navController.popBackStack() },
                                )
                            }
                            composable("admin/salary") { SalaryScreen(salary, isAdmin = true, onRefresh = refresh) }
                            composable("admin/manage") {
                                AdminManagementScreen(
                                    onNews = { navController.navigate("admin/news") },
                                    onCatalog = { navController.navigate("admin/catalog") },
                                    onChats = { navController.navigate("admin/chats") },
                                    onStaff = { navController.navigate("admin/staff") },
                                    onReviews = { navController.navigate("admin/reviews") },
                                    onCrafts = { navController.navigate("admin/crafts") },
                                    onAbout = { navController.navigate("admin/about") },
                                    onSupportChats = { navController.navigate("admin/support-chats") },
                                    onCustomers = { navController.navigate("admin/customers") },
                                )
                            }
                            composable("admin/about") {
                                CompanyScreen(token, true, busy, runAction, onBack = { navController.popBackStack() }, banners = banners, onCampaignNavigate = onCampaignNavigate)
                            }
                            composable("admin/crafts") { CraftsScreen(token, true, craftItems, craftOrders, runAction, refresh, { navController.popBackStack() }, banners, onCampaignNavigate) }
                            composable("admin/news") {
                                NewsManagementScreen(token, news, runAction, refresh) { navController.popBackStack() }
                            }
                            composable("admin/catalog") {
                                CatalogManagementScreen(token, catalogItems, runAction, refresh) { navController.popBackStack() }
                            }
                            composable("admin/chats") {
                                AdminChatInboxScreen(adminChats, refresh, { navController.navigate("chat/$it") }) { navController.popBackStack() }
                            }
                            composable("admin/staff") { StaffManagementScreen(token, user, staff, runAction, refresh) }
                            composable("admin/customers") { CustomerManagementScreen(token, runAction) { navController.popBackStack() } }
                            composable("admin/reviews") { ReviewsScreen("Все отзывы", reviews, refresh, token = token, canModerate = true, runAction = runAction) }
                            composable("admin/profile") { ProfileScreen(user, token, runAction, onUserUpdated, onPasswordChanged, onLogout) }
                        }
                    }
                    addSupportChatRoutes(
                        role = user.role,
                        userId = user.id,
                        token = token,
                        supportChats = supportChats,
                        activeSupportChat = activeSupportChat,
                        busy = busy,
                        runAction = runAction,
                        onChatUpdated = onSupportChatUpdated,
                        onRefreshChat = onRefreshSupportChat,
                        onRefreshInbox = onRefreshSupportInbox,
                        onOpenAdminChat = { customerId -> navController.navigate("admin/support-chat/$customerId") },
                        onBack = { navController.popBackStack() },
                    )
                    composable("chat/{orderId}") { entry ->
                        val orderId = entry.arguments?.getString("orderId").orEmpty()
                        LaunchedEffect(orderId, token) { onRefreshChat(orderId) }
                        RepairChatScreen(
                            orderId = orderId,
                            role = user.role,
                            token = token,
                            chat = activeChat?.takeIf { it.orderId == orderId },
                            busy = busy,
                            runAction = runAction,
                            onChatUpdated = onChatUpdated,
                            onRefresh = { onRefreshChat(orderId) },
                            onBack = { navController.popBackStack() },
                        )
                    }
                }
            }
        }
    }
}
