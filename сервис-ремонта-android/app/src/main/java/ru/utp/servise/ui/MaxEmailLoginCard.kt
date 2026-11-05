package ru.utp.servise.ui

import android.util.Patterns
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.AppUser

@Composable
fun MaxEmailLoginCard(
    token: String,
    runAction: RunAction,
    onUserUpdated: (AppUser) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var codeRequested by remember { mutableStateOf(false) }
    var confirmationError by remember { mutableStateOf<String?>(null) }

    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Резервный вход по почте", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Подтвердите адрес и задайте пароль. После этого сможете входить и через МАКС, и по почте с паролем.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            OutlinedTextField(
                value = email,
                onValueChange = {
                    if (email != it) {
                        email = it.take(320)
                        codeRequested = false
                        code = ""
                        password = ""
                        confirmPassword = ""
                        confirmationError = null
                    }
                },
                label = { Text("Электронная почта") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                shape = RoundedCornerShape(16.dp),
            )
            if (codeRequested) {
                Text("Код отправлен на ${email.trim()}. Он действует 10 минут.", fontSize = 12.sp, color = UtpMuted)
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.filter(Char::isDigit).take(6) },
                    label = { Text("Шестизначный код из письма") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(16.dp),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it.take(128) },
                    label = { Text("Пароль для входа (от 8 символов)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(16.dp),
                )
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it.take(128) },
                    label = { Text("Повторите пароль") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(16.dp),
                )
                confirmationError?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
                Button(
                    onClick = {
                        val error = when {
                            code.length != 6 -> "Введите шестизначный код из письма."
                            password.length < 8 -> "Пароль должен содержать не менее 8 символов."
                            password != confirmPassword -> "Пароли не совпадают."
                            else -> null
                        }
                        confirmationError = error
                        if (error == null) {
                            runAction({ ApiClient.confirmMaxEmailLogin(token, email, code, password) }) { result ->
                                (result as? AppUser)?.let(onUserUpdated)
                            }
                        }
                    },
                    enabled = email.isNotBlank() && code.length == 6 && password.length >= 8 && confirmPassword.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                ) { Text("Подтвердить и сохранить") }
            } else {
                Button(
                    onClick = {
                        runAction({ ApiClient.requestMaxEmailLoginCode(token, email) }) {
                            codeRequested = true
                            confirmationError = null
                        }
                    },
                    enabled = Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                ) { Text("Отправить код") }
            }
        }
    }
    Spacer(Modifier.height(12.dp))
}
