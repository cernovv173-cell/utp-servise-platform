package ru.utp.servise.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant

@Composable
fun HolidayClosureBanner(phoneNumber: String?) {
    var now by remember { mutableStateOf(Instant.now()) }
    val phase = holidayClosurePhase(now)
    LaunchedEffect(phase) {
        when (phase) {
            HolidayClosurePhase.UPCOMING -> {
                val waitMillis = Duration.between(now, holidayClosureStartsAt).toMillis().coerceAtLeast(0)
                delay(waitMillis)
                now = Instant.now()
            }
            HolidayClosurePhase.CLOSED -> {
                while (holidayClosurePhase(now) == HolidayClosurePhase.CLOSED) {
                    delay(1_000)
                    now = Instant.now()
                }
            }
            HolidayClosurePhase.REOPENED -> Unit
        }
    }
    val countdown = holidayClosureCountdown(now) ?: return
    val context = LocalContext.current
    val dialNumber = phoneNumber.orEmpty().filter { it.isDigit() || it == '+' }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF173B83)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF173B83))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "🎄  НОВОГОДНИЙ ПЕРЕРЫВ",
                color = Color(0xFFDBEAFE),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )
            Text(
                text = "Сервис временно не работает",
                color = Color.White,
                fontSize = 21.sp,
                lineHeight = 26.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Перерыв — с 31 декабря 2026 по 10 января 2027 включительно. Откроемся 11 января 2027 года в 08:30 по московскому времени.",
                color = Color(0xFFE0E7FF),
                fontSize = 13.sp,
                lineHeight = 19.sp,
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text("⏳", fontSize = 16.sp)
                    Text("ДО ОТКРЫТИЯ", color = Color(0xFFBFDBFE), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                }
                CountdownRow(
                    first = countdown.days to "ДНЕЙ",
                    second = countdown.hours to "ЧАСОВ",
                )
                CountdownRow(
                    first = countdown.minutes to "МИНУТ",
                    second = countdown.seconds to "СЕКУНД",
                )
            }

            if (dialNumber.isNotBlank()) {
                Button(
                    onClick = {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$dialNumber")))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = Color(0xFF173B83),
                    ),
                ) {
                    Icon(Icons.Filled.Call, contentDescription = null)
                    Text(
                        text = "Если заказ срочный — звоните: $phoneNumber",
                        modifier = Modifier.padding(start = 7.dp),
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun CountdownRow(first: Pair<Long, String>, second: Pair<Long, String>) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        CountdownCell(first.first, first.second, Modifier.weight(1f))
        CountdownCell(second.first, second.second, Modifier.weight(1f))
    }
}

@Composable
private fun CountdownCell(value: Long, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(Color(0x33FFFFFF), RoundedCornerShape(14.dp))
            .padding(vertical = 10.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = value.toString().padStart(2, '0'),
            color = Color.White,
            fontSize = 28.sp,
            lineHeight = 30.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = label,
            color = Color(0xFFDBEAFE),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
            textAlign = TextAlign.Center,
        )
    }
}
