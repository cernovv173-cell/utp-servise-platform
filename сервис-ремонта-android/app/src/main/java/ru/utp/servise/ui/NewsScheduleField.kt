package ru.utp.servise.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Calendar

@Composable
fun ScheduleDateTimeField(label: String, value: String?, onChange: (String?) -> Unit) {
    val context = LocalContext.current
    val dateFormatter = remember {
        DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.systemDefault())
    }
    val shown = value?.let { runCatching { dateFormatter.format(Instant.parse(it)) }.getOrNull() }
        ?: "не задано"
    Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedButton(
            onClick = {
                val selected = Calendar.getInstance().apply {
                    value?.let { runCatching { timeInMillis = Instant.parse(it).toEpochMilli() } }
                }
                DatePickerDialog(
                    context,
                    { _, year, month, day ->
                        val date = Calendar.getInstance().apply {
                            clear()
                            set(year, month, day)
                        }
                        TimePickerDialog(
                            context,
                            { _, hour, minute ->
                                date.set(Calendar.HOUR_OF_DAY, hour)
                                date.set(Calendar.MINUTE, minute)
                                onChange(Instant.ofEpochMilli(date.timeInMillis).toString())
                            },
                            selected.get(Calendar.HOUR_OF_DAY),
                            selected.get(Calendar.MINUTE),
                            true,
                        ).show()
                    },
                    selected.get(Calendar.YEAR),
                    selected.get(Calendar.MONTH),
                    selected.get(Calendar.DAY_OF_MONTH),
                ).show()
            },
            modifier = Modifier.weight(1f),
        ) {
            Text(
                "$label: $shown",
                style = MaterialTheme.typography.labelLarge,
            )
        }
        if (value != null) TextButton(onClick = { onChange(null) }) { Text("Очистить") }
    }
}

internal fun formatNewsScheduleDate(prefix: String, value: String?): String {
    val formatted = value?.let {
        runCatching {
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")
                .withZone(ZoneId.systemDefault())
                .format(Instant.parse(it))
        }.getOrNull()
    }
    return "$prefix ${formatted ?: "без даты"}"
}
