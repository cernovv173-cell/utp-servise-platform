package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient

@Composable
internal fun CustomerFeedbackScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onBack: () -> Unit,
) {
    var type by rememberSaveable { mutableStateOf("SUGGESTION") }
    var content by rememberSaveable { mutableStateOf("") }
    var submitted by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        TextButton(onClick = onBack) { Text("← Назад") }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Жалобы и предложения",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = UtpInk,
            )
            Text(
                "Сообщение будет видно только администраторам сервиса.",
                fontSize = 13.sp,
                color = UtpMuted,
            )
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Тип обращения", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (type == "COMPLAINT") {
                        Button(
                            onClick = { type = "COMPLAINT" },
                            colors = ButtonDefaults.buttonColors(containerColor = UtpBlue),
                        ) { Text("Жалоба") }
                    } else {
                        OutlinedButton(onClick = { type = "COMPLAINT" }) { Text("Жалоба") }
                    }
                    if (type == "SUGGESTION") {
                        Button(
                            onClick = { type = "SUGGESTION" },
                            colors = ButtonDefaults.buttonColors(containerColor = UtpBlue),
                        ) { Text("Предложение") }
                    } else {
                        OutlinedButton(onClick = { type = "SUGGESTION" }) { Text("Предложение") }
                    }
                }
                OutlinedTextField(
                    value = content,
                    onValueChange = {
                        if (it.length <= 2000) content = it
                        submitted = false
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Сообщение") },
                    placeholder = { Text("Опишите ситуацию или вашу идею…") },
                    minLines = 5,
                    maxLines = 9,
                    supportingText = { Text("${content.length}/2000") },
                    enabled = !busy,
                )
                Button(
                    onClick = {
                        val message = content.trim()
                        if (message.isNotEmpty()) {
                            runAction({ ApiClient.submitCustomerFeedback(token, type, message) }) {
                                content = ""
                                submitted = true
                            }
                        }
                    },
                    enabled = content.isNotBlank() && !busy,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = UtpBlue),
                ) {
                    Text(if (busy) "Отправляем…" else "Отправить")
                }
            }
        }

        if (submitted) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                ),
            ) {
                Text(
                    "Спасибо! Сообщение передано администраторам.",
                    modifier = Modifier.padding(14.dp),
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    fontSize = 13.sp,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}
