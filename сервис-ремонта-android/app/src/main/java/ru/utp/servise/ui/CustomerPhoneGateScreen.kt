package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.phoneNumberValidationError

@Composable
internal fun CustomerPhoneGateScreen(
    busy: Boolean,
    errorMessage: String?,
    onDismissError: () -> Unit,
    onSave: (String) -> Unit,
    onLogout: () -> Unit,
) {
    var phoneNumber by remember { mutableStateOf("") }
    val phoneError = phoneNumberValidationError(phoneNumber)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Укажите номер телефона", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text(
                    "Телефон нужен, чтобы мастер и администратор могли связаться с вами по заявке. " +
                        "Личный кабинет откроется после сохранения корректного номера.",
                    fontSize = 14.sp,
                    color = UtpMuted,
                )
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it.take(40) },
                    label = { Text("Телефон *") },
                    placeholder = { Text("+7 999 123-45-67") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = phoneNumber.isNotBlank() && phoneError != null,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    shape = RoundedCornerShape(14.dp),
                )
                Text(
                    text = phoneError ?: "Введите номер, по которому с вами можно связаться.",
                    fontSize = 12.sp,
                    color = if (phoneError != null) MaterialTheme.colorScheme.error else UtpMuted,
                )
                if (!errorMessage.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(errorMessage, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = onDismissError) { Text("×") }
                    }
                }
                Button(
                    onClick = { onSave(phoneNumber.trim()) },
                    enabled = !busy && phoneError == null && phoneNumber.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(15.dp),
                ) {
                    Text(if (busy) "Сохраняем…" else "Сохранить и продолжить")
                }
                Spacer(Modifier.height(2.dp))
                TextButton(onClick = onLogout, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text("Выйти из аккаунта")
                }
            }
        }
    }
}
