package ru.utp.servise

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.AdminChatInboxItem
import ru.utp.servise.data.AuthResult
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.OrderChat
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.SessionStore
import ru.utp.servise.data.StaffMember
import ru.utp.servise.ui.AuthNavigation
import ru.utp.servise.ui.ChangeTemporaryPasswordScreen
import ru.utp.servise.ui.CatalogManagementScreen
import ru.utp.servise.ui.AdminManagementScreen
import ru.utp.servise.ui.AdminChatInboxScreen
import ru.utp.servise.ui.RepairChatScreen
import ru.utp.servise.ui.CustomerHomeScreen
import ru.utp.servise.ui.ProfileScreen
import ru.utp.servise.ui.RepairOrdersScreen
import ru.utp.servise.ui.RepairRequestForm
import ru.utp.servise.ui.ReviewFormScreen
import ru.utp.servise.ui.ReviewsScreen
import ru.utp.servise.ui.NewsManagementScreen
import ru.utp.servise.ui.RunAction
import ru.utp.servise.ui.StaffManagementScreen
import ru.utp.servise.ui.UtpBlue
import ru.utp.servise.ui.UtpPale
import ru.utp.servise.ui.UtpServiseTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { UtpServiseTheme { UtpServiseApp() } }
    }
}

private data class WorkspaceData(
    val orders: List<RepairOrder>,
    val reviews: List<CustomerReview>,
    val staff: List<StaffMember>,
    val catalogItems: List<CatalogItem>,
    val news: List<NewsArticle>,
    val adminChats: List<AdminChatInboxItem>,
)

@Composable
private fun UtpServiseApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val tokenStore = remember { SessionStore(context) }
    var token by remember { mutableStateOf("") }
    var user by remember { mutableStateOf<AppUser?>(null) }
    var sessionReady by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableStateOf(0) }
    var orders by remember { mutableStateOf<List<RepairOrder>>(emptyList()) }
    var staff by remember { mutableStateOf<List<StaffMember>>(emptyList()) }
    var reviews by remember { mutableStateOf<List<CustomerReview>>(emptyList()) }
    var catalogItems by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var news by remember { mutableStateOf<List<NewsArticle>>(emptyList()) }
    var adminChats by remember { mutableStateOf<List<AdminChatInboxItem>>(emptyList()) }
    var activeChat by remember { mutableStateOf<OrderChat?>(null) }

    LaunchedEffect(Unit) {
        val existing = withContext(Dispatchers.IO) { runCatching { tokenStore.readToken() }.getOrNull() }
        if (!existing.isNullOrBlank()) {
            runCatching { withContext(Dispatchers.IO) { ApiClient.me(existing) } }
                .onSuccess { restored -> token = existing; user = restored }
                .onFailure { tokenStore.clear() }
        }
        sessionReady = true
    }

    val onAuthenticated: (String, AppUser) -> Unit = { newToken, newUser ->
        runCatching { tokenStore.saveToken(newToken) }
            .onSuccess { token = newToken; user = newUser; errorMessage = null }
            .onFailure { errorMessage = "Не удалось сохранить защищённую сессию. Попробуйте ещё раз." }
    }

    val runAction: RunAction = { action, onSuccess ->
        scope.launch {
            busy = true
            errorMessage = null
            try {
                val result = withContext(Dispatchers.IO) { action() }
                onSuccess(result)
                revision += 1
            } catch (failure: Throwable) {
                errorMessage = failure.message ?: "Не удалось выполнить действие. Проверьте подключение к серверу."
            } finally {
                busy = false
            }
        }
    }

    LaunchedEffect(token, user?.id, revision) {
        val currentUser = user
        if (token.isNotBlank() && currentUser != null && !currentUser.mustChangePassword) {
            runCatching {
                withContext(Dispatchers.IO) {
                    WorkspaceData(
                        orders = ApiClient.orders(token),
                        reviews = ApiClient.reviews(token),
                        staff = if (currentUser.role == "ADMIN") ApiClient.staff(token) else emptyList(),
                        catalogItems = if (currentUser.role == "ADMIN" || currentUser.role == "TECHNICIAN") ApiClient.catalog(token) else emptyList(),
                        news = ApiClient.news(token),
                        adminChats = if (currentUser.role == "ADMIN") ApiClient.administratorChatInbox(token) else emptyList(),
                    )
                }
            }.onSuccess { data ->
                orders = data.orders
                reviews = data.reviews
                staff = data.staff
                catalogItems = data.catalogItems
                news = data.news
                adminChats = data.adminChats
            }.onFailure { errorMessage = it.message ?: "Не удалось загрузить данные." }
        }
    }

    when {
        !sessionReady -> LoadingScreen()
        user == null -> AuthNavigation(
            onAuthenticated = onAuthenticated,
            onBusy = { busy = it },
            onError = { errorMessage = it },
        )
        user!!.mustChangePassword -> ChangeTemporaryPasswordScreen(
            onChange = { oldPassword, newPassword, onDone ->
                runAction({ ApiClient.changePassword(token, oldPassword, newPassword) }) { value ->
                    val auth = value as? AuthResult
                    if (auth != null) {
                        onAuthenticated(auth.accessToken, auth.user)
                        onDone(auth)
                    }
                }
            },
            busy = busy,
        )
        else -> AuthenticatedWorkspace(
            user = user!!,
            token = token,
            orders = orders,
            staff = staff,
            reviews = reviews,
            catalogItems = catalogItems,
            news = news,
            adminChats = adminChats,
            activeChat = activeChat,
            onChatUpdated = { activeChat = it },
            busy = busy,
            errorMessage = errorMessage,
            onError = { errorMessage = it },
            onDismissError = { errorMessage = null },
            runAction = runAction,
            refresh = { revision += 1 },
            onLogout = {
                val activeToken = token
                scope.launch { runCatching { withContext(Dispatchers.IO) { ApiClient.logout(activeToken) } } }
                tokenStore.clear()
                token = ""
                user = null
                orders = emptyList()
                staff = emptyList()
                reviews = emptyList()
                catalogItems = emptyList()
                news = emptyList()
                adminChats = emptyList()
                activeChat = null
                errorMessage = null
            },
        )
    }
}

private data class Destination(val route: String, val label: String, val icon: String)

@Composable
private fun AuthenticatedWorkspace(
    user: AppUser,
    token: String,
    orders: List<RepairOrder>,
    staff: List<StaffMember>,
    reviews: List<CustomerReview>,
    catalogItems: List<CatalogItem>,
    news: List<NewsArticle>,
    adminChats: List<AdminChatInboxItem>,
    activeChat: OrderChat?,
    onChatUpdated: (OrderChat) -> Unit,
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
            Destination("technician/reviews", "Отзывы", "★"),
            Destination("technician/profile", "Профиль", "♙"),
        )
        "ADMIN" -> listOf(
            Destination("admin/orders", "Заказы", "▤"),
            Destination("admin/history", "История", "◷"),
            Destination("admin/manage", "Управление", "⚙"),
            Destination("admin/profile", "Профиль", "⚙"),
        )
        else -> listOf(
            Destination("customer/home", "Главная", "⌂"),
            Destination("customer/orders", "Заявки", "▤"),
            Destination("customer/history", "История", "◷"),
            Destination("customer/reviews", "Отзывы", "★"),
            Destination("customer/profile", "Профиль", "♙"),
        )
    }
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val mainRoutes = destinations.map { it.route }

    Scaffold(
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
                            composable("customer/home") { CustomerHomeScreen(user, news, { navController.navigate("customer/new-order") }, { navController.navigate("customer/orders") }) }
                            composable("customer/orders") {
                                RepairOrdersScreen("Мои заявки", orders, user.role, token, emptyList(), catalogItems, false, runAction, refresh, onChat = { navController.navigate("chat/$it") }) { id -> navController.navigate("customer/review/$id") }
                            }
                            composable("customer/history") {
                                RepairOrdersScreen("История ремонтов", orders, user.role, token, emptyList(), catalogItems, true, runAction, refresh, onChat = { navController.navigate("chat/$it") }) { id -> navController.navigate("customer/review/$id") }
                            }
                            composable("customer/reviews") { ReviewsScreen("Мои отзывы", reviews, refresh) }
                            composable("customer/profile") { ProfileScreen(user, onLogout) }
                            composable("customer/new-order") {
                                RepairRequestForm(
                                    onBack = { navController.popBackStack() },
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
                            composable("technician/jobs") { RepairOrdersScreen("Назначенные заказы", orders, user.role, token, emptyList(), catalogItems, false, runAction, refresh, onChat = { navController.navigate("chat/$it") }) {} }
                            composable("technician/history") { RepairOrdersScreen("История ремонтов", orders, user.role, token, emptyList(), catalogItems, true, runAction, refresh, onChat = { navController.navigate("chat/$it") }) {} }
                            composable("technician/reviews") { ReviewsScreen("Отзывы о работе", reviews, refresh) }
                            composable("technician/profile") { ProfileScreen(user, onLogout) }
                        }
                        else -> {
                            composable("admin/orders") { RepairOrdersScreen("Управление заказами", orders, user.role, token, staff, catalogItems, false, runAction, refresh) {} }
                            composable("admin/history") { RepairOrdersScreen("История ремонтов", orders, user.role, token, staff, catalogItems, true, runAction, refresh) {} }
                            composable("admin/manage") {
                                AdminManagementScreen(
                                    onNews = { navController.navigate("admin/news") },
                                    onCatalog = { navController.navigate("admin/catalog") },
                                    onChats = { navController.navigate("admin/chats") },
                                    onStaff = { navController.navigate("admin/staff") },
                                    onReviews = { navController.navigate("admin/reviews") },
                                )
                            }
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
                            composable("admin/reviews") { ReviewsScreen("Все отзывы", reviews, refresh) }
                            composable("admin/profile") { ProfileScreen(user, onLogout) }
                        }
                    }
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

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize().background(UtpPale), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(color = UtpBlue)
            Text("UTP Servise", fontWeight = FontWeight.SemiBold)
        }
    }
}
