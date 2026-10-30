package ru.utp.servise

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import ru.utp.servise.data.CustomerDevice
import ru.utp.servise.data.CustomerOffer
import ru.utp.servise.data.CustomerServicePrice
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.LoyaltyAccount
import ru.utp.servise.data.ReferralProgram
import ru.utp.servise.data.SeasonalThemeState
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.TechnologyFact
import ru.utp.servise.data.OrderChat
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.SalarySummary
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.SupportChat
import ru.utp.servise.data.SupportChatInboxItem
import ru.utp.servise.navigation.workspaceNavigationForRole
import ru.utp.servise.ui.AdminChatInboxScreen
import ru.utp.servise.ui.AdminManagementScreen
import ru.utp.servise.ui.AdminOrderCreationScreen
import ru.utp.servise.ui.AdminShopOrdersScreen
import ru.utp.servise.ui.AppVersionScreen
import ru.utp.servise.ui.CatalogManagementScreen
import ru.utp.servise.ui.TechnicianCatalogScreen
import ru.utp.servise.ui.CompanyScreen
import ru.utp.servise.ui.CraftsScreen
import ru.utp.servise.ui.CustomerHomeScreen
import ru.utp.servise.ui.CustomerShopScreen
import ru.utp.servise.ui.CustomerOffersScreen
import ru.utp.servise.ui.CustomerDevicesScreen
import ru.utp.servise.ui.CustomerManagementScreen
import ru.utp.servise.ui.LoyaltyScreen
import ru.utp.servise.ui.NewsFeedScreen
import ru.utp.servise.ui.NewsManagementScreen
import ru.utp.servise.ui.ProfileScreen
import ru.utp.servise.ui.RepairChatScreen
import ru.utp.servise.ui.RepairOrdersScreen
import ru.utp.servise.ui.RepairRequestForm
import ru.utp.servise.ui.RepairScheduleScreen
import ru.utp.servise.ui.PartsProcurementScreen
import ru.utp.servise.ui.ProcurementInventoryScreen
import ru.utp.servise.ui.ServiceDashboardScreen
import ru.utp.servise.ui.compressSelectedImage
import ru.utp.servise.ui.ReviewFormScreen
import ru.utp.servise.ui.ReviewsScreen
import ru.utp.servise.ui.RunAction
import ru.utp.servise.ui.StaffManagementScreen
import ru.utp.servise.ui.SalaryScreen
import ru.utp.servise.ui.SeasonalThemeCard
import ru.utp.servise.ui.UtpBlue
import ru.utp.servise.ui.WorkspaceSectionsScreen

@Composable
internal fun AuthenticatedWorkspace(
    user: AppUser,
    token: String,
    orders: List<RepairOrder>,
    staff: List<StaffMember>,
    reviews: List<CustomerReview>,
    customerDevices: List<CustomerDevice>,
    customerServicePrices: List<CustomerServicePrice>,
    catalogItems: List<CatalogItem>,
    craftItems: List<CraftItem>,
    craftOrders: List<CraftOrder>,
    news: List<NewsArticle>,
    technologyFact: TechnologyFact?,
    customerOffers: List<CustomerOffer>,
    banners: List<SiteBanner>,
    loyalty: LoyaltyAccount,
    referralProgram: ReferralProgram,
    seasonalTheme: SeasonalThemeState,
    onSeasonalThemeChanged: (SeasonalThemeState) -> Unit,
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
    val appContext = LocalContext.current
    val onRefreshChat: (String) -> Unit = { orderId ->
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { ApiClient.orderChat(token, orderId) } }
                .onSuccess(onChatUpdated)
                .onFailure { onError(it.message ?: "Не удалось обновить чат.") }
        }
    }
    val workspaceNavigation = remember(user.role) { workspaceNavigationForRole(user.role) }
    val destinations = workspaceNavigation.primaryDestinations
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
    val activeBottomRoute = workspaceNavigation.selectedTabRoute(currentRoute)

    Scaffold(
        containerColor = androidx.compose.ui.graphics.Color.Transparent,
        floatingActionButton = {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (user.role == "ADMIN" && currentRoute != "admin/new-order") {
                    ExtendedFloatingActionButton(
                        onClick = { navController.navigate("admin/new-order") { launchSingleTop = true } },
                        icon = { Text("⏻", fontSize = 20.sp) },
                        text = {
                            Column {
                                Text("СТАРТ / СТОП", fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                                Text("Создать заявку", fontWeight = FontWeight.SemiBold)
                            }
                        },
                        containerColor = UtpBlue,
                        contentColor = Color.White,
                    )
                }
            }
        },
        bottomBar = {
            if (activeBottomRoute != null) {
                NavigationBar {
                    destinations.forEach { destination ->
                        NavigationBarItem(
                            selected = activeBottomRoute == destination.route,
                            onClick = {
                                navController.navigate(destination.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(destination.icon, contentDescription = null) },
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
                NavHost(
                    navController = navController,
                    startDestination = destinations.first().route,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    when (user.role) {
                        "CUSTOMER" -> {
                            composable("customer/home") {
                                CustomerHomeScreen(
                                    user, token, news, technologyFact, banners,
                                    { navController.navigate("customer/new-order") },
                                    { navController.navigate("customer/orders") },
                                    { navController.navigate("customer/shop") },
                                    { navController.navigate("customer/crafts") },
                                    { navController.navigate("customer/about") },
                                    { navController.navigate("customer/news") },
                                    { navController.navigate("customer/loyalty") },
                                    onCampaignNavigate,
                                    { navController.navigate("customer/support-chat") },
                                    onOpenOffers = {
                                        navController.navigate("customer/offers") { launchSingleTop = true }
                                    },
                                )
                            }
                            composable("customer/shop") {
                                CustomerShopScreen(
                                    user = user,
                                    token = token,
                                    runAction = runAction,
                                    onBack = { navController.popBackStack() },
                                )
                            }
                            composable("customer/news") {
                                NewsFeedScreen(token, news, reviews, banners, onCampaignNavigate)
                            }
                            composable("customer/offers") {
                                CustomerOffersScreen(
                                    offers = customerOffers,
                                    busy = busy,
                                    onParticipate = { offerId ->
                                        runAction({ ApiClient.participateInCustomerOffer(token, offerId) }) {
                                            refresh()
                                        }
                                    },
                                )
                            }
                            composable("customer/loyalty") {
                                LoyaltyScreen(loyalty, referralProgram, token, banners, onCampaignNavigate)
                            }
                            composable("customer/about") {
                                CompanyScreen(token, false, busy, runAction, onBack = { navController.popBackStack() }, banners = banners, onCampaignNavigate = onCampaignNavigate)
                            }
                            composable("customer/crafts") { CraftsScreen(token, false, craftItems, craftOrders, staff, runAction, refresh, { navController.popBackStack() }, banners, onCampaignNavigate) }
                            composable("customer/orders") {
                                RepairOrdersScreen("Мои ремонты", orders, user.role, token, emptyList(), catalogItems, false, runAction, refresh, onChat = { navController.navigate("chat/$it") }, onReview = { id -> navController.navigate("customer/review/$id") })
                            }
                            composable("customer/history") {
                                RepairOrdersScreen("История ремонтов", orders, user.role, token, emptyList(), catalogItems, true, runAction, refresh, onChat = { navController.navigate("chat/$it") }, onReview = { id -> navController.navigate("customer/review/$id") })
                            }
                            composable("customer/devices") {
                                CustomerDevicesScreen(
                                    devices = customerDevices,
                                    onRepeat = { deviceId ->
                                        navController.currentBackStackEntry?.savedStateHandle?.set("repeatDeviceId", deviceId)
                                        navController.navigate("customer/new-order") { launchSingleTop = true }
                                    },
                                    onCreate = { type, nickname, brand, model, serial, date, note ->
                                        runAction({ ApiClient.createCustomerDevice(token, type, nickname, brand, model, serial, date, note) }) { refresh() }
                                    },
                                    onWarrantyClaim = { originalOrderId, problem ->
                                        runAction({ ApiClient.createWarrantyClaim(token, originalOrderId, problem) }) { result ->
                                            refresh()
                                            (result as? RepairOrder)?.id?.let { navController.navigate("chat/$it") }
                                        }
                                    },
                                    onSaveReminder = { deviceId, date, note ->
                                        runAction({ ApiClient.updateCustomerDeviceReminder(token, deviceId, date, note) }) { refresh() }
                                    },
                                    onDelete = { deviceId ->
                                        runAction({ ApiClient.deleteCustomerDevice(token, deviceId) }) { refresh() }
                                    },
                                    busy = busy,
                                )
                            }
                            composable("customer/reviews") { ReviewsScreen("Мои отзывы", reviews, refresh, token = token) }
                            composable("customer/profile") {
                                ProfileScreen(
                                    user,
                                    token,
                                    runAction,
                                    onUserUpdated,
                                    onPasswordChanged,
                                    onLogout,
                                    onAccountDeleted = onLogout,
                                    onOpenSections = { navController.navigate("sections") { launchSingleTop = true } },
                                    onOpenVersion = { navController.navigate("app/version") { launchSingleTop = true } },
                                )
                            }
                            composable("customer/new-order") {
                                val repeatDeviceId = navController.previousBackStackEntry?.savedStateHandle?.get<String>("repeatDeviceId")
                                RepairRequestForm(
                                    initialPhone = user.phoneNumber.orEmpty(),
                                    onBack = { navController.popBackStack() },
                                    banners = banners,
                                    token = token,
                                    customerDevices = customerDevices,
                                    servicePrices = customerServicePrices,
                                    initialDeviceId = repeatDeviceId,
                                    onCampaignNavigate = onCampaignNavigate,
                                    onSubmit = { device, problem, address, details, photoUri ->
                                        runAction({
                                            val order = ApiClient.createOrder(token, device, problem, address, details)
                                            photoUri?.let { uri ->
                                                runCatching {
                                                    ApiClient.uploadOrderPhoto(
                                                        token,
                                                        order.id,
                                                        compressSelectedImage(appContext, uri),
                                                    )
                                                }.onFailure {
                                                    onError("Заявка создана, но фото не загрузилось. Его можно добавить в карточке заявки.")
                                                }
                                            }
                                            order
                                        }) { navController.popBackStack() }
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
                            composable("technician/catalog") { TechnicianCatalogScreen(catalogItems) }
                            composable("technician/salary") { SalaryScreen(salary, isAdmin = false, onRefresh = refresh) }
                            composable("technician/reviews") { ReviewsScreen("Отзывы о работе", reviews, refresh, token = token) }
                            composable("technician/about") { CompanyScreen(token, false, busy, runAction, onBack = null, banners = banners, onCampaignNavigate = onCampaignNavigate) }
                            composable("technician/profile") {
                                ProfileScreen(
                                    user,
                                    token,
                                    runAction,
                                    onUserUpdated,
                                    onPasswordChanged,
                                    onLogout,
                                    onOpenSections = { navController.navigate("sections") { launchSingleTop = true } },
                                    onOpenVersion = { navController.navigate("app/version") { launchSingleTop = true } },
                                )
                            }
                        }
                        "PROCUREMENT" -> {
                            composable("procurement/home") {
                                PartsProcurementScreen(token, onError)
                            }
                            composable("procurement/catalog") {
                                ProcurementInventoryScreen(
                                    catalogItems = catalogItems,
                                    token = token,
                                    busy = busy,
                                    runAction = runAction,
                                    onRefresh = refresh,
                                    onError = onError,
                                )
                            }
                            composable("procurement/profile") {
                                ProfileScreen(
                                    user,
                                    token,
                                    runAction,
                                    onUserUpdated,
                                    onPasswordChanged,
                                    onLogout,
                                    onOpenVersion = { navController.navigate("app/version") { launchSingleTop = true } },
                                )
                            }
                        }
                        else -> {
                            composable("admin/orders") {
                                RepairOrdersScreen(
                                    "Управление заказами", orders, user.role, token, staff,
                                    catalogItems, false, runAction, refresh, onReview = {},
                                )
                            }
                            composable("admin/seasonal") {
                                SeasonalThemeCard(
                                    state = seasonalTheme,
                                    busy = busy,
                                    onSeasonChange = { season ->
                                        runAction(
                                            { ApiClient.setSeasonalTheme(token, season) },
                                            { result ->
                                                (result as? SeasonalThemeState)?.let(onSeasonalThemeChanged)
                                            },
                                        )
                                    },
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 20.dp),
                                )
                            }
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
                                    onOverview = { navController.navigate("admin/overview") },
                                    onSchedule = { navController.navigate("admin/schedule") },
                                    onProcurement = { navController.navigate("admin/procurement") },
                                    onNews = { navController.navigate("admin/news") },
                                    onCatalog = { navController.navigate("admin/catalog") },
                                    onChats = { navController.navigate("admin/chats") },
                                    onStaff = { navController.navigate("admin/staff") },
                                    onReviews = { navController.navigate("admin/reviews") },
                                    onCrafts = { navController.navigate("admin/crafts") },
                                    onAbout = { navController.navigate("admin/about") },
                                    onSupportChats = { navController.navigate("admin/support-chats") },
                                    onCustomers = { navController.navigate("admin/customers") },
                                    onShopOrders = { navController.navigate("admin/shop-orders") },
                                    onSalary = { navController.navigate("admin/salary") },
                                )
                            }
                            composable("admin/overview") { ServiceDashboardScreen(token, onError) }
                            composable("admin/schedule") {
                                RepairScheduleScreen(
                                    token = token,
                                    busy = busy,
                                    runAction = runAction,
                                    onError = onError,
                                    onOpenOrders = { navController.navigate("admin/orders") },
                                )
                            }
                            composable("admin/procurement") { PartsProcurementScreen(token, onError) }
                            composable("admin/about") {
                                CompanyScreen(token, true, busy, runAction, onBack = { navController.popBackStack() }, banners = banners, onCampaignNavigate = onCampaignNavigate)
                            }
                            composable("admin/crafts") { CraftsScreen(token, true, craftItems, craftOrders, staff, runAction, refresh, { navController.popBackStack() }, banners, onCampaignNavigate) }
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
                            composable("admin/customers") {
                                CustomerManagementScreen(token, busy, runAction) { navController.popBackStack() }
                            }
                            composable("admin/shop-orders") {
                                AdminShopOrdersScreen(
                                    token = token,
                                    busy = busy,
                                    runAction = runAction,
                                    onBack = { navController.popBackStack() },
                                    onRefresh = refresh,
                                )
                            }
                            composable("admin/reviews") { ReviewsScreen("Все отзывы", reviews, refresh, token = token, canModerate = true, runAction = runAction) }
                            composable("admin/profile") {
                                ProfileScreen(
                                    user,
                                    token,
                                    runAction,
                                    onUserUpdated,
                                    onPasswordChanged,
                                    onLogout,
                                    onOpenVersion = { navController.navigate("app/version") { launchSingleTop = true } },
                                )
                            }
                        }
                    }
                    composable("app/version") {
                        AppVersionScreen(onBack = { navController.popBackStack() })
                    }
                    workspaceNavigation.sectionHubRoute?.let { route ->
                        composable(route) {
                            WorkspaceSectionsScreen(
                                groups = workspaceNavigation.sectionGroups,
                                onOpenSection = { destinationRoute ->
                                    navController.navigate(destinationRoute) { launchSingleTop = true }
                                },
                            )
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
