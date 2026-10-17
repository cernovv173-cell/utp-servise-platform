package ru.utp.servise.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.yandex.authsdk.YandexAuthLoginOptions
import com.yandex.authsdk.YandexAuthOptions
import com.yandex.authsdk.YandexAuthResult
import com.yandex.authsdk.YandexAuthSdk
import com.vk.id.VKID
import com.vk.id.VKIDAuthFail
import com.vk.id.auth.VKIDAuthCallback
import com.vk.id.auth.VKIDAuthParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.BuildConfig
import ru.utp.servise.data.AppUser

@Composable
fun AuthNavigation(onAuthenticated: (String, AppUser) -> Unit, onBusy: (Boolean) -> Unit, onError: (String?) -> Unit) {
    val controller = androidx.navigation.compose.rememberNavController()
    NavHost(controller, startDestination = "entry") {
        composable("entry") {
            PublicHomeScreen(
                onRequest = { controller.navigate("register") },
                onCustomerLogin = { controller.navigate("login/CUSTOMER") },
                onTechnicianLogin = { controller.navigate("login/TECHNICIAN") },
                onAdminLogin = { controller.navigate("login/ADMIN") },
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
    var referralCode by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var recovering by remember { mutableStateOf(false) }
    var recoveryMessage by remember { mutableStateOf<String?>(null) }
    var yandexTokenToLink by remember { mutableStateOf<String?>(null) }
    var vkTokenToLink by remember { mutableStateOf<String?>(null) }

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
                        referralCode.trim().takeIf { it.isNotEmpty() },
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

    fun completeVkLogin(accessToken: String, linkPassword: String? = null) {
        onError(null)
        scope.launch {
            onBusy(true)
            try {
                val result = withContext(Dispatchers.IO) {
                    ru.utp.servise.data.ApiClient.loginWithVk(
                        accessToken,
                        portal,
                        linkPassword,
                        referralCode.trim().takeIf { it.isNotEmpty() },
                    )
                }
                vkTokenToLink = null
                onAuthenticated(result.accessToken, result.user)
            } catch (failure: Throwable) {
                if ((failure as? ru.utp.servise.data.ApiException)?.errorCode == "VK_PASSWORD_REQUIRED") {
                    vkTokenToLink = accessToken
                    onError("Для привязки VK ID к существующему аккаунту подтвердите его пароль.")
                } else {
                    onError(failure.message ?: "Не удалось выполнить вход через VK ID.")
                }
            } finally {
                onBusy(false)
            }
        }
    }

    Column(
        Modifier.fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(22.dp),
    ) {
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
            if (portal == "CUSTOMER") {
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = referralCode,
                    onValueChange = { referralCode = it.trim().uppercase().take(16) },
                    label = { Text("Код приглашения (если есть)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                )
                Text(
                    "Применится только при создании нового аккаунта через Яндекс ID или VK ID.",
                    fontSize = 11.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
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
            if (BuildConfig.VK_ID_APP_ID.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                VkIdLoginButton(
                    onToken = { completeVkLogin(it) },
                    onError = onError,
                )
                vkTokenToLink?.let { pendingToken ->
                    OutlinedButton(
                        onClick = { completeVkLogin(pendingToken, password) },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        enabled = password.isNotEmpty(),
                        shape = RoundedCornerShape(15.dp),
                    ) { Text("Подтвердить привязку VK ID") }
                }
            }
            TextButton(onClick = { recovering = true; recoveryMessage = null; onError(null) }, modifier = Modifier.fillMaxWidth()) {
                Text("Забыли пароль?")
            }
        }
    }
}

@Composable
private fun VkIdLoginButton(
    onToken: (String) -> Unit,
    onError: (String?) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val callback = remember(onToken, onError) {
        object : VKIDAuthCallback {
            override fun onAuth(accessToken: com.vk.id.AccessToken) {
                onToken(accessToken.token)
            }

            override fun onFail(fail: VKIDAuthFail) {
                if (fail !is VKIDAuthFail.Canceled) {
                    onError("Не удалось войти через VK ID. Попробуйте ещё раз.")
                }
            }
        }
    }
    OutlinedButton(
        onClick = {
            onError(null)
            scope.launch {
                try {
                    VKID.instance.authorize(
                        callback = callback,
                        params = VKIDAuthParams { scopes = setOf("email") },
                    )
                } catch (_: Throwable) {
                    onError("Не удалось запустить вход через VK ID. Проверьте подключение и повторите попытку.")
                }
            }
        },
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(15.dp),
    ) {
        Text("Войти через VK ID")
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
    var referralCode by remember { mutableStateOf("") }
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
        OutlinedTextField(
            value = referralCode,
            onValueChange = { referralCode = it.uppercase().take(16) },
            label = { Text("Код приглашения (если есть)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
        )
        Text(
            "После завершения первого ремонта и подтверждения оплаты сервисом вам и пригласившему начислят по 100 бонусных баллов.",
            fontSize = 11.sp,
            color = UtpMuted,
            lineHeight = 16.sp,
            modifier = Modifier.padding(top = 5.dp),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(password, { password = it }, label = { Text("Пароль (не менее 8 символов)") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(18.dp))
        Button(onClick = {
            onError(null)
            performAuth(scope, onBusy, onError, onAuthenticated) {
                ru.utp.servise.data.ApiClient.register(
                    email.trim(),
                    name.trim(),
                    password,
                    phoneNumber.trim().takeIf { it.isNotEmpty() },
                    referralCode.trim().takeIf { it.isNotEmpty() },
                )
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
