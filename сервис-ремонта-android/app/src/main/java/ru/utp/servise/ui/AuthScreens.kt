package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.yandex.authsdk.YandexAuthLoginOptions
import com.yandex.authsdk.YandexAuthOptions
import com.yandex.authsdk.YandexAuthResult
import com.yandex.authsdk.YandexAuthSdk
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.BuildConfig
import ru.utp.servise.R
import ru.utp.servise.data.AppUser

@Composable
fun AuthNavigation(onAuthenticated: (String, AppUser) -> Unit, onBusy: (Boolean) -> Unit, onError: (String?) -> Unit) {
    val controller = androidx.navigation.compose.rememberNavController()
    NavHost(controller, startDestination = "entry") {
        composable("entry") {
            AuthEntryScreen(
                onLogin = { portal -> controller.navigate("login/$portal") },
                onRegister = { controller.navigate("register") },
            )
        }
        composable("login/{portal}") { entry ->
            LoginScreen(
                portal = entry.arguments?.getString("portal") ?: "CUSTOMER",
                onBack = { controller.popBackStack() },
                onAuthenticated = onAuthenticated,
                onBusy = onBusy,
                onError = onError,
            )
        }
        composable("register") {
            RegisterScreen(
                onBack = { controller.popBackStack() },
                onAuthenticated = onAuthenticated,
                onBusy = onBusy,
                onError = onError,
            )
        }
    }
}

@Composable
private fun AuthEntryScreen(onLogin: (String) -> Unit, onRegister: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(UtpPale).padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(painterResource(R.drawable.utp_servise_logo), "Логотип UTP Servise", Modifier.size(104.dp).clip(RoundedCornerShape(26.dp)))
        Spacer(Modifier.height(16.dp))
        Text("UTP Servise", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Сервис ремонта компьютеров и гаджетов", color = UtpMuted, modifier = Modifier.padding(top = 6.dp, bottom = 28.dp))
        PortalCard("Клиент", "Оформление заявок и история ремонта", "👤") { onLogin("CUSTOMER") }
        Spacer(Modifier.height(10.dp))
        PortalCard("Мастер", "Назначенные заказы и статусы", "🛠") { onLogin("TECHNICIAN") }
        Spacer(Modifier.height(10.dp))
        PortalCard("Администратор", "Заказы, сотрудники и отзывы", "▦") { onLogin("ADMIN") }
        TextButton(onClick = onRegister, modifier = Modifier.padding(top = 12.dp)) { Text("Создать аккаунт клиента") }
        Text("Роли сотрудников выдаёт только администратор", fontSize = 12.sp, color = UtpMuted)
    }
}

@Composable
private fun PortalCard(title: String, description: String, icon: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(17.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(icon, fontSize = 23.sp, modifier = Modifier.padding(end = 14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(description, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp))
            }
            Text("›", color = UtpBlue, fontSize = 24.sp)
        }
    }
}

@Composable
private fun LoginScreen(
    portal: String,
    onBack: () -> Unit,
    onAuthenticated: (String, AppUser) -> Unit,
    onBusy: (Boolean) -> Unit,
    onError: (String?) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var recovering by remember { mutableStateOf(false) }
    var recoveryMessage by remember { mutableStateOf<String?>(null) }
    var yandexTokenToLink by remember { mutableStateOf<String?>(null) }

    fun completeYandexLogin(accessToken: String, linkPassword: String? = null) {
        onError(null)
        scope.launch {
            onBusy(true)
            try {
                val result = withContext(Dispatchers.IO) {
                    ru.utp.servise.data.ApiClient.loginWithYandex(
                        accessToken,
                        portal,
                        linkPassword,
                    )
                }
                yandexTokenToLink = null
                onAuthenticated(result.accessToken, result.user)
            } catch (failure: Throwable) {
                if (
                    (failure as? ru.utp.servise.data.ApiException)?.errorCode ==
                    "YANDEX_PASSWORD_REQUIRED"
                ) {
                    yandexTokenToLink = accessToken
                    onError("Для привязки к существующему аккаунту введите его пароль и подтвердите вход.")
                } else {
                    onError(failure.message ?: "Не удалось выполнить вход через Яндекс ID.")
                }
            } finally {
                onBusy(false)
            }
        }
    }

    Column(Modifier.fillMaxSize().background(UtpPale).padding(22.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text(if (recovering) "Восстановление пароля" else "Вход: ${portal.roleLabel()}", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            if (recovering) "Укажите адрес аккаунта — мы отправим ссылку для создания нового пароля."
            else "Введите выданный для этой роли адрес и пароль.",
            color = UtpMuted,
            modifier = Modifier.padding(top = 6.dp, bottom = 22.dp),
        )
        OutlinedTextField(email, { email = it }, label = { Text("Электронная почта") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp))
        if (recovering) {
            recoveryMessage?.let {
                Text(it, color = UtpBlue, modifier = Modifier.padding(top = 12.dp))
            }
            Spacer(Modifier.height(18.dp))
            Button(onClick = {
                onError(null)
                scope.launch {
                    onBusy(true)
                    try {
                        withContext(Dispatchers.IO) {
                            ru.utp.servise.data.ApiClient.requestPasswordReset(email.trim())
                        }
                        recoveryMessage = "Если аккаунт с таким адресом существует, письмо отправлено. Откройте ссылку из письма в браузере, чтобы задать новый пароль."
                    } catch (error: Throwable) {
                        onError(error.message ?: "Не удалось отправить запрос. Проверьте подключение.")
                    } finally {
                        onBusy(false)
                    }
                }
            }, modifier = Modifier.fillMaxWidth().height(52.dp), enabled = email.isNotBlank(), shape = RoundedCornerShape(15.dp)) {
                Text("Отправить ссылку")
            }
            TextButton(onClick = { recovering = false; recoveryMessage = null; onError(null) }, modifier = Modifier.fillMaxWidth()) {
                Text("Вернуться ко входу")
            }
        } else {
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                password, { password = it }, label = { Text("Пароль") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Скрыть" else "Показать") } },
                shape = RoundedCornerShape(14.dp),
            )
            Spacer(Modifier.height(18.dp))
            Button(onClick = {
                onError(null)
                performAuth(scope, onBusy, onError, onAuthenticated) { ru.utp.servise.data.ApiClient.login(email.trim(), password, portal) }
            }, modifier = Modifier.fillMaxWidth().height(52.dp), enabled = email.isNotBlank() && password.isNotEmpty(), shape = RoundedCornerShape(15.dp)) { Text("Войти") }
            if (BuildConfig.YANDEX_CLIENT_ID.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                YandexIdLoginButton(
                    enabled = true,
                    onToken = { completeYandexLogin(it) },
                    onError = onError,
                )
                yandexTokenToLink?.let { pendingToken ->
                    OutlinedButton(
                        onClick = { completeYandexLogin(pendingToken, password) },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        enabled = password.isNotEmpty(),
                        shape = RoundedCornerShape(15.dp),
                    ) { Text("Подтвердить привязку Яндекс ID") }
                }
            }
            TextButton(onClick = { recovering = true; recoveryMessage = null; onError(null) }, modifier = Modifier.fillMaxWidth()) {
                Text("Забыли пароль?")
            }
        }
    }
}

@Composable
private fun YandexIdLoginButton(
    enabled: Boolean,
    onToken: (String) -> Unit,
    onError: (String?) -> Unit,
) {
    val context = LocalContext.current
    val sdk = remember(context) {
        YandexAuthSdk.create(YandexAuthOptions(context.applicationContext))
    }
    val launcher = rememberLauncherForActivityResult(sdk.contract) { result ->
        when (result) {
            is YandexAuthResult.Success -> onToken(result.token.value)
            is YandexAuthResult.Failure -> onError("Не удалось войти через Яндекс ID. Попробуйте ещё раз.")
            YandexAuthResult.Cancelled -> Unit
        }
    }

    OutlinedButton(
        onClick = { launcher.launch(YandexAuthLoginOptions()) },
        modifier = Modifier.fillMaxWidth().height(48.dp),
        enabled = enabled,
        shape = RoundedCornerShape(15.dp),
    ) {
        Text("Войти через Яндекс ID")
    }
}

@Composable
private fun RegisterScreen(
    onBack: () -> Unit,
    onAuthenticated: (String, AppUser) -> Unit,
    onBusy: (Boolean) -> Unit,
    onError: (String?) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(22.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Аккаунт клиента", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Регистрация создаёт только клиентскую роль.", color = UtpMuted, modifier = Modifier.padding(top = 6.dp, bottom = 20.dp))
        OutlinedTextField(name, { name = it }, label = { Text("Имя") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Электронная почта") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it },
            label = { Text("Телефон (необязательно)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            shape = RoundedCornerShape(16.dp),
        )
        Text("Контакт будет доступен только участникам вашей заявки.", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp))
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(password, { password = it }, label = { Text("Пароль (не менее 8 символов)") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(18.dp))
        Button(onClick = {
            onError(null)
            performAuth(scope, onBusy, onError, onAuthenticated) {
                ru.utp.servise.data.ApiClient.register(email.trim(), name.trim(), password, phoneNumber.trim().takeIf { it.isNotEmpty() })
            }
        }, modifier = Modifier.fillMaxWidth().height(52.dp), enabled = name.trim().length >= 2 && email.isNotBlank() && password.length >= 8, shape = RoundedCornerShape(18.dp)) { Text("Зарегистрироваться") }
    }
}

private fun String.roleLabel(): String = when (this) {
    "CUSTOMER" -> "клиента"
    "TECHNICIAN" -> "мастера"
    "ADMIN" -> "администратора"
    else -> "пользователя"
}

private fun performAuth(
    scope: CoroutineScope,
    onBusy: (Boolean) -> Unit,
    onError: (String?) -> Unit,
    onAuthenticated: (String, AppUser) -> Unit,
    request: suspend () -> ru.utp.servise.data.AuthResult,
) {
    scope.launch {
        onBusy(true)
        try {
            val result = withContext(Dispatchers.IO) { request() }
            onAuthenticated(result.accessToken, result.user)
        } catch (error: Throwable) {
            onError(error.message ?: "Не удалось выполнить вход. Проверьте подключение.")
        } finally {
            onBusy(false)
        }
    }
}
