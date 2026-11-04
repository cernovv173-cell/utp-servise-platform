package ru.utp.servise.ui

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
import ru.utp.servise.data.phoneNumberValidationError

@Composable
fun AuthNavigation(onAuthenticated: (String, AppUser) -> Unit, onBusy: (Boolean) -> Unit, onError: (String?) -> Unit) {
    val controller = androidx.navigation.compose.rememberNavController()
    NavHost(controller, startDestination = "entry") {
        composable("entry") {
            PublicHomeScreen(
                onRequest = { controller.navigate("register") },
                onCustomerLogin = { controller.navigate("login/CUSTOMER") },
                onTechnicianLogin = { controller.navigate("login/TECHNICIAN") },
                onProcurementLogin = { controller.navigate("login/PROCUREMENT") },
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
    var vkTokenToLink by remember { mutableStateOf<String?>(null) }
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
        if (!recovering && portal == "CUSTOMER") {
            MaxLoginCard(
                referralCode = referralCode,
                enabled = true,
                onBusy = onBusy,
                onError = onError,
                onAuthenticated = onAuthenticated,
            )
            Text(
                "или по почте",
                fontSize = 12.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 14.dp, bottom = 10.dp),
            )
        }
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
                    "Применится только при создании нового аккаунта через МАКС или VK ID.",
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
        PrivacyPolicyLink(modifier = Modifier.fillMaxWidth())
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
    val phoneError = phoneNumberValidationError(phoneNumber)
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(22.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Аккаунт клиента", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Регистрация создаёт только клиентскую роль.", color = UtpMuted, modifier = Modifier.padding(top = 6.dp, bottom = 20.dp))
        MaxLoginCard(
            referralCode = referralCode,
            enabled = true,
            onBusy = onBusy,
            onError = onError,
            onAuthenticated = onAuthenticated,
        )
        Text(
            "или заполните форму",
            fontSize = 12.sp,
            color = UtpMuted,
            modifier = Modifier.padding(top = 14.dp, bottom = 10.dp),
        )
        OutlinedTextField(name, { name = it }, label = { Text("Имя") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Электронная почта") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp))
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it.take(40) },
            label = { Text("Телефон *") },
            placeholder = { Text("+7 999 123-45-67") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            isError = phoneNumber.isNotBlank() && phoneError != null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            shape = RoundedCornerShape(16.dp),
        )
        Text(
            phoneError ?: "Номер нужен для связи по заявке.",
            fontSize = 11.sp,
            color = if (phoneNumber.isNotBlank() && phoneError != null) androidx.compose.material3.MaterialTheme.colorScheme.error else UtpMuted,
            modifier = Modifier.padding(top = 5.dp),
        )
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
            "После первого завершённого и оплаченного ремонта вам и пригласившему начислят по 250 бонусных баллов.",
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
                    phoneNumber.trim(),
                    referralCode.trim().takeIf { it.isNotEmpty() },
                )
            }
        }, modifier = Modifier.fillMaxWidth().height(52.dp), enabled = name.trim().length >= 2 && email.isNotBlank() && password.length >= 8 && phoneError == null && phoneNumber.isNotBlank(), shape = RoundedCornerShape(18.dp)) { Text("Зарегистрироваться") }
        PrivacyPolicyLink(modifier = Modifier.fillMaxWidth())
    }
}

private fun String.roleLabel(): String = when (this) {
    "CUSTOMER" -> "клиента"
    "TECHNICIAN" -> "мастера"
    "PROCUREMENT" -> "мастера закупки"
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
