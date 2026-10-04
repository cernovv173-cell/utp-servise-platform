package ru.utp.servise

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.firebase.FirebaseApp
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.AdminChatInboxItem
import ru.utp.servise.data.AuthResult
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.LoyaltyAccount
import ru.utp.servise.data.OrderChat
import ru.utp.servise.data.PushTokenManager
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.SessionStore
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.SalarySummary
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.SupportChat
import ru.utp.servise.data.SupportChatInboxItem
import ru.utp.servise.notifications.NotificationChannels
import ru.utp.servise.ui.AuthNavigation
import ru.utp.servise.ui.ChangeTemporaryPasswordScreen
import ru.utp.servise.ui.RunAction
import ru.utp.servise.ui.UtpBlue
import ru.utp.servise.ui.UtpPale
import ru.utp.servise.ui.UtpServiseTheme
import ru.utp.servise.ui.WelcomeAnimation
import ru.utp.servise.ui.WelcomeAnimationMode
import ru.utp.servise.ui.readWelcomeAnimationMode

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NotificationChannels.ensureCreated(this)
        setContent { UtpServiseTheme { UtpServiseApp() } }
    }
}

@Composable
private fun UtpServiseApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val welcomeAnimationMode = remember(context) { readWelcomeAnimationMode(context) }
    var showWelcome by remember {
        mutableStateOf(welcomeAnimationMode != WelcomeAnimationMode.OFF)
    }
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
    var craftItems by remember { mutableStateOf<List<CraftItem>>(emptyList()) }
    var craftOrders by remember { mutableStateOf<List<CraftOrder>>(emptyList()) }
    var news by remember { mutableStateOf<List<NewsArticle>>(emptyList()) }
    var banners by remember { mutableStateOf<List<SiteBanner>>(emptyList()) }
    var loyalty by remember { mutableStateOf(LoyaltyAccount(0, emptyList())) }
    var salary by remember { mutableStateOf(SalarySummary()) }
    var adminChats by remember { mutableStateOf<List<AdminChatInboxItem>>(emptyList()) }
    var activeChat by remember { mutableStateOf<OrderChat?>(null) }
    var supportChats by remember { mutableStateOf<List<SupportChatInboxItem>>(emptyList()) }
    var activeSupportChat by remember { mutableStateOf<SupportChat?>(null) }
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    LaunchedEffect(Unit) {
        val existing = withContext(Dispatchers.IO) { runCatching { tokenStore.readToken() }.getOrNull() }
        if (!existing.isNullOrBlank()) {
            runCatching { withContext(Dispatchers.IO) { ApiClient.me(existing) } }
                .onSuccess { restored ->
                    token = existing
                    user = restored
                    PushTokenManager.synchronize(context, existing)
                }
                .onFailure { tokenStore.clear() }
        }
        sessionReady = true
    }

    LaunchedEffect(user?.id) {
        if (
            user != null &&
            FirebaseApp.getApps(context).isNotEmpty() &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val onAuthenticated: (String, AppUser) -> Unit = { newToken, newUser ->
        runCatching { tokenStore.saveToken(newToken) }
            .onSuccess {
                token = newToken
                user = newUser
                errorMessage = null
                PushTokenManager.synchronize(context, newToken)
            }
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
                        orders = ApiClient.orders(token, archived = false) +
                            ApiClient.orders(token, archived = true),
                        reviews = ApiClient.reviews(token),
                        staff = if (currentUser.role == "ADMIN") ApiClient.staff(token) else emptyList(),
                        catalogItems = if (currentUser.role == "ADMIN" || currentUser.role == "TECHNICIAN") ApiClient.catalog(token) else emptyList(),
                        craftItems = ApiClient.craftItems(token),
                        craftOrders = if (currentUser.role == "ADMIN" || currentUser.role == "CUSTOMER") ApiClient.craftOrders(token) else emptyList(),
                        news = ApiClient.news(token),
                        banners = ApiClient.banners(token),
                        loyalty = if (currentUser.role == "CUSTOMER") ApiClient.loyalty(token) else LoyaltyAccount(0, emptyList()),
                        salary = if (currentUser.role == "ADMIN" || currentUser.role == "TECHNICIAN") ApiClient.salary(token) else SalarySummary(),
                        adminChats = if (currentUser.role == "ADMIN") ApiClient.administratorChatInbox(token) else emptyList(),
                        supportChats = if (currentUser.role == "ADMIN") ApiClient.administratorSupportChats(token) else emptyList(),
                    )
                }
            }.onSuccess { data ->
                orders = data.orders
                reviews = data.reviews
                staff = data.staff
                catalogItems = data.catalogItems
                craftItems = data.craftItems
                craftOrders = data.craftOrders
                news = data.news
                banners = data.banners
                loyalty = data.loyalty
                salary = data.salary
                adminChats = data.adminChats
                supportChats = data.supportChats
            }.onFailure { errorMessage = it.message ?: "Не удалось загрузить данные." }
        }
    }

    Box(Modifier.fillMaxSize()) {
        Image(
            painter = painterResource(R.drawable.repair_nebula_bg),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alpha = 0.58f,
            modifier = Modifier.fillMaxSize(),
        )
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
            craftItems = craftItems,
            craftOrders = craftOrders,
            news = news,
            banners = banners,
            loyalty = loyalty,
            salary = salary,
            adminChats = adminChats,
            supportChats = supportChats,
            activeChat = activeChat,
            onChatUpdated = { activeChat = it },
            activeSupportChat = activeSupportChat,
            onSupportChatUpdated = { activeSupportChat = it },
            onRefreshSupportChat = { customerId ->
                scope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) {
                            if (user?.role == "ADMIN") {
                                val targetId = customerId ?: error("Не выбран клиент чата.")
                                ApiClient.administratorSupportChat(token, targetId)
                            } else {
                                ApiClient.supportChat(token)
                            }
                        }
                    }.onSuccess { activeSupportChat = it }
                        .onFailure { errorMessage = it.message ?: "Не удалось обновить чат поддержки." }
                }
            },
            onRefreshSupportInbox = {
                scope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) { ApiClient.administratorSupportChats(token) }
                    }.onSuccess { supportChats = it }
                        .onFailure { errorMessage = it.message ?: "Не удалось обновить чаты клиентов." }
                }
            },
            onUserUpdated = { user = it },
            onPasswordChanged = { auth -> onAuthenticated(auth.accessToken, auth.user) },
            busy = busy,
            errorMessage = errorMessage,
            onError = { errorMessage = it },
            onDismissError = { errorMessage = null },
            runAction = runAction,
            refresh = { revision += 1 },
            onLogout = {
                val activeToken = token
                scope.launch {
                    withContext(Dispatchers.IO) {
                        runCatching {
                            if (FirebaseApp.getApps(context).isNotEmpty()) {
                                val pushToken = Tasks.await(FirebaseMessaging.getInstance().token)
                                ApiClient.unregisterPushToken(activeToken, pushToken)
                            }
                        }
                        runCatching { ApiClient.logout(activeToken) }
                    }
                }
                tokenStore.clear()
                token = ""
                user = null
                orders = emptyList()
                staff = emptyList()
                reviews = emptyList()
                catalogItems = emptyList()
                craftItems = emptyList()
                craftOrders = emptyList()
                news = emptyList()
                banners = emptyList()
                loyalty = LoyaltyAccount(0, emptyList())
                adminChats = emptyList()
                activeChat = null
                supportChats = emptyList()
                activeSupportChat = null
                errorMessage = null
            },
            )
        }
        if (showWelcome) {
            WelcomeAnimation(
                mode = welcomeAnimationMode,
                onFinished = { showWelcome = false },
            )
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
