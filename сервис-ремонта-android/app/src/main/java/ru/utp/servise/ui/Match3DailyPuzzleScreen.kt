package ru.utp.servise.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.utp.servise.data.Match3DailyChallenge
import ru.utp.servise.data.Match3Position

private const val DAILY_PUZZLE_PREFERENCES = "match3_daily_challenge_v1"

@Composable
fun Match3DailyPuzzleScreen(userId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val preferences = remember(context) {
        context.getSharedPreferences(DAILY_PUZZLE_PREFERENCES, Context.MODE_PRIVATE)
    }
    var dayKey by remember { mutableStateOf(Match3DailyChallenge.dayKey()) }
    val board = remember(dayKey) { Match3DailyChallenge.createBoard(dayKey) }
    var completedDayKey by remember(userId) { mutableStateOf(preferences.getString(userId, null)) }
    var selected by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var message by remember { mutableStateOf("") }
    val completed = completedDayKey == dayKey

    LaunchedEffect(userId) {
        while (true) {
            delay(60_000)
            val currentDay = Match3DailyChallenge.dayKey()
            if (currentDay != dayKey) {
                dayKey = currentDay
                completedDayKey = preferences.getString(userId, null)
                selected = null
                message = ""
            }
        }
    }

    fun completeMove(first: Pair<Int, Int>, second: Pair<Int, Int>) {
        val (row, column) = second
        if (kotlin.math.abs(first.first - row) + kotlin.math.abs(first.second - column) != 1) {
            selected = second
            return
        }
        val solved = Match3DailyChallenge.isSuccessfulMove(
            board,
            Match3Position(first.first, first.second),
            Match3Position(row, column),
        )
        selected = null
        if (solved) {
            completedDayKey = dayKey
            preferences.edit().putString(userId, dayKey).apply()
            message = "Отличный ход! Новая задача появится завтра."
        } else {
            message = "Эта пара не собирает три в ряд. Попробуй другой соседний обмен."
        }
    }

    fun selectTile(row: Int, column: Int) {
        val position = row to column
        val first = selected
        if (first == null || first == position) {
            selected = if (first == null) position else null
            return
        }
        completeMove(first, position)
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            TextButton(onClick = onBack) { Text("← Назад") }
            Text("Испытание дня", fontSize = 21.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        }
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = UtpMint)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("📅 ЗАДАЧА НА $dayKey", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
                Text("Найди удачный обмен", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text(
                    "Выбери две соседние фишки, чтобы собрать три одинаковые детали в линию. Попытки не ограничены.",
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    color = UtpMuted,
                )
            }
        }

        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Match3Board(
                    board = board,
                    selected = selected,
                    enabled = !completed,
                    onTileSelected = ::selectTile,
                    onTileSwiped = { fromRow, fromColumn, toRow, toColumn ->
                        selected = null
                        completeMove(fromRow to fromColumn, toRow to toColumn)
                    },
                )
                if (message.isNotBlank()) {
                    Text(
                        message,
                        modifier = Modifier.fillMaxWidth().background(
                            if (completed) UtpMint else MaterialTheme.colorScheme.secondaryContainer,
                            RoundedCornerShape(12.dp),
                        ).padding(12.dp),
                        color = UtpInk,
                        fontSize = 13.sp,
                    )
                }
            }
        }

        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (completed) "Задача решена ✓" else "Одна комбинация — и готово", fontWeight = FontWeight.Bold, color = UtpInk)
                Text(
                    if (completed) "Енот принесёт новую головоломку завтра."
                    else "Найди соседний обмен, после которого появятся три одинаковые детали.",
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    color = UtpMuted,
                )
                Text(
                    "Это отдельная головоломка: она не меняет уровни, очки и награды кампании. Отметка хранится отдельно на этом устройстве для твоего аккаунта.",
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = UtpMuted,
                )
                if (completed) {
                    OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                        Text("К основной игре")
                    }
                }
            }
        }
    }
}
