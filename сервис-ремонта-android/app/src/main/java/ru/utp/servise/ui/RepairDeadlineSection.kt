package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder

private fun deadlineLabel(value: String?): String =
    if (value == null) "срок не задан" else formatNewsScheduleDate("", value).trim()

@Composable
internal fun RepairDeadlineSection(
    order: RepairOrder,
    role: String,
    token: String,
    runAction: RunAction,
) {
    var selectedDate by remember(order.id, order.expectedCompletionAt) {
        mutableStateOf(order.expectedCompletionAt)
    }
    var note by remember(order.id) { mutableStateOf("") }
    val canEdit = role == "ADMIN"

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.42f)),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text("ПЛАНОВАЯ ГОТОВНОСТЬ", fontSize = 10.sp, color = UtpBlue, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
            if (!canEdit) {
                Text(deadlineLabel(order.expectedCompletionAt), fontSize = 14.sp, color = UtpInk, fontWeight = FontWeight.SemiBold)
            } else {
                ScheduleDateTimeField("Срок готовности", selectedDate) { selectedDate = it }
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it.take(500) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Пояснение клиенту (необязательно)") },
                    minLines = 1,
                    maxLines = 3,
                )
                Button(
                    onClick = {
                        runAction({
                            ApiClient.setExpectedCompletion(token, order.id, selectedDate, note)
                        }) { note = "" }
                    },
                    enabled = selectedDate != order.expectedCompletionAt,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Сохранить срок и уведомить клиента")
                }
            }

            Text("История изменений", fontSize = 12.sp, color = UtpInk, fontWeight = FontWeight.SemiBold)
            if (order.deadlineChanges.isEmpty()) {
                Text("Переносов срока пока нет.", fontSize = 11.sp, color = UtpMuted)
            } else {
                order.deadlineChanges.forEach { change ->
                    Column(modifier = Modifier.padding(top = 2.dp)) {
                        Text(
                            "${deadlineLabel(change.previousExpectedAt)} → ${deadlineLabel(change.expectedCompletionAt)}",
                            fontSize = 11.sp,
                            color = UtpInk,
                            fontWeight = FontWeight.Medium,
                        )
                        Text(
                            listOfNotNull(
                                change.actorName?.takeIf { it.isNotBlank() },
                                change.createdAt.takeIf { it.isNotBlank() },
                            ).joinToString(" · "),
                            fontSize = 10.sp,
                            color = UtpMuted,
                        )
                        change.note?.takeIf { it.isNotBlank() }?.let {
                            Text("Пояснение: $it", fontSize = 10.sp, color = UtpMuted)
                        }
                    }
                }
            }
        }
    }
}
