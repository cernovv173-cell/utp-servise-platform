package ru.utp.servise.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.Match3Api
import ru.utp.servise.data.Match3Hint
import ru.utp.servise.data.Match3Progress
import ru.utp.servise.data.Match3Session

private data class ChapterStory(val afterLevel: Int, val chapter: String, val narration: String, val dialogue: String)
private data class Visor(val id: String, val title: String, val icon: String, val unlockAt: Int)
private const val RACCOON_VOICE_PREFERENCES = "match3_raccoon_voice_v1"
private const val RACCOON_EPILOGUE_DIALOGUE = "Мы сделали это! Спасибо, что помог мне собрать компьютер мечты!"

private val chapterStories = listOf(
    ChapterStory(20, "Материнская плата", "Последняя пластина встаёт на место. Енот проверяет корпус: тот звенит, как маленький колокол, и ни одна деталь не шатается.", "Теперь нужны дорожки, которые соединят все части. В корнях старого леса спрятана материнская плата!"),
    ChapterStory(40, "Процессор", "Магические корни сплетаются в сеть проводников, и по ним пробегает зелёный свет. В чаще енот находит кристалл, который отвечает на каждый импульс.", "Ограню его — и появится сердце компьютера, его процессор!"),
    ChapterStory(60, "Система охлаждения", "Кристалл оживает, освещая всю поляну. Но детали нагрелись от его силы, и металлический корпус уже потрескивает.", "Нужно охладить сборку. Ледяные феи, помогите моему компьютеру!"),
    ChapterStory(80, "Первый запуск", "Ледяные феи укрощают жар, и последние детали занимают свои места в мастерской. Енот включает визор и сверяется с чертежом.", "Почти готово. Остался первый запуск — держу лапы крестиком!"),
)

private val visors = listOf(
    Visor("default", "Обычный", "🦝", 0),
    Visor("forest", "Лесной", "🌿", 20),
    Visor("crystal", "Кристалл", "💎", 40),
    Visor("processor", "Микросхема", "🧠", 60),
    Visor("frost", "Лёд", "❄️", 80),
    Visor("first-boot", "Первый запуск", "🚀", 100),
)

@Composable
fun Match3GameScreen(token: String, onBack: () -> Unit, onDailyPuzzle: () -> Unit) {
    val context = LocalContext.current
    val voicePreferences = remember(context) {
        context.getSharedPreferences(RACCOON_VOICE_PREFERENCES, Context.MODE_PRIVATE)
    }
    var gameProgress by remember(token) { mutableStateOf<Match3Progress?>(null) }
    var session by remember(token) { mutableStateOf<Match3Session?>(null) }
    var gameHint by remember(token) { mutableStateOf<Match3Hint?>(null) }
    var selected by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var selectedBooster by remember { mutableStateOf<String?>(null) }
    var selectedVisor by remember(token) { mutableStateOf("default") }
    var loading by remember(token) { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var dismissedStories by remember { mutableStateOf(emptySet<Int>()) }
    var epilogueDismissed by remember { mutableStateOf(false) }
    var reloadVersion by remember(token) { mutableStateOf(0) }
    var voiceEnabled by remember(context) { mutableStateOf(voicePreferences.getBoolean("enabled", false)) }
    var speechAvailable by remember { mutableStateOf<Boolean?>(null) }
    var isSpeaking by remember { mutableStateOf(false) }
    val speech = remember(context) {
        RaccoonSpeech(
            context = context,
            onAvailabilityChanged = { speechAvailable = it },
            onSpeakingChanged = { isSpeaking = it },
        )
    }
    val scope = rememberCoroutineScope()

    DisposableEffect(speech) {
        onDispose { speech.shutdown() }
    }

    fun repeatRaccoonLine(line: String) {
        if (voiceEnabled && speechAvailable == true) speech.speak(line)
    }

    fun setVoiceEnabled(enabled: Boolean) {
        voiceEnabled = enabled
        voicePreferences.edit().putBoolean("enabled", enabled).apply()
    }

    LaunchedEffect(token, reloadVersion) {
        loading = true
        try {
            val snapshot = withContext(Dispatchers.IO) { Match3Api.progress(token) }
            gameProgress = snapshot
            session = snapshot.activeSession
            selectedVisor = withContext(Dispatchers.IO) {
                Match3Api.selectedCosmetic(token) ?: Match3Api.initializeCosmetic(token, "default")
            }
        } catch (failure: Exception) {
            error = failure.message ?: "Не удалось загрузить игру. Проверьте соединение."
        } finally {
            loading = false
        }
    }

    fun startLevel() {
        scope.launch {
            busy = true
            error = null
            notice = null
            try {
                session = withContext(Dispatchers.IO) { Match3Api.start(token) }
                selected = null
                selectedBooster = null
                gameHint = null
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось начать уровень."
            } finally {
                busy = false
            }
        }
    }

    fun restartLevel() {
        val active = session ?: return
        scope.launch {
            busy = true
            error = null
            notice = null
            try {
                session = withContext(Dispatchers.IO) {
                    Match3Api.restart(token, active.id)
                }
                gameProgress = withContext(Dispatchers.IO) { Match3Api.progress(token) }
                selected = null
                selectedBooster = null
                gameHint = null
                notice = "Уровень начат заново. Пройденные этапы, баллы и бустеры сохранены."
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось начать уровень заново."
            } finally {
                busy = false
            }
        }
    }

    fun claimGamePoints() {
        scope.launch {
            busy = true
            error = null
            try {
                val result = withContext(Dispatchers.IO) { Match3Api.claimRewards(token) }
                gameProgress = withContext(Dispatchers.IO) { Match3Api.progress(token) }
                notice = if (result.claimedPoints > 0) {
                    "Зачислено ${result.claimedPoints} баллов за прохождения уровней."
                } else "Нет новых баллов для получения."
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось получить баллы."
            } finally {
                busy = false
            }
        }
    }

    fun showMoveHint() {
        val active = session ?: return
        scope.launch {
            busy = true
            error = null
            try {
                gameHint = withContext(Dispatchers.IO) { Match3Api.hint(token, active.id) }
                notice = if (gameHint == null) {
                    "Подходящий ход не найден. Попробуйте перезапустить уровень."
                } else {
                    "Поменяйте местами подсвеченные фишки. Подсказка не расходует ход."
                }
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось получить подсказку."
            } finally {
                busy = false
            }
        }
    }

    fun craftBooster(boosterId: String) {
        scope.launch {
            busy = true
            error = null
            try {
                withContext(Dispatchers.IO) { Match3Api.craftBooster(token, boosterId) }
                gameProgress = withContext(Dispatchers.IO) { Match3Api.progress(token) }
                val name = gameProgress?.boosterCatalog?.firstOrNull { it.id == boosterId }?.name ?: "бустер"
                notice = "Собран бустер «$name»."
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось собрать бустер."
            } finally {
                busy = false
            }
        }
    }

    fun useBooster(row: Int, column: Int) {
        val active = session ?: return
        val boosterId = selectedBooster ?: return
        scope.launch {
            busy = true
            error = null
            try {
                val result = withContext(Dispatchers.IO) {
                    Match3Api.useBooster(token, active.id, boosterId, row, column)
                }
                session = result.session
                selected = null
                selectedBooster = null
                gameHint = null
                gameProgress = withContext(Dispatchers.IO) { Match3Api.progress(token) }
                notice = if (result.pointsAwarded > 0) {
                    "Уровень пройден! Баллы готовы к получению."
                } else "Бустер применён: очищена область поля, потрачен один ход."
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось применить бустер."
            } finally {
                busy = false
            }
        }
    }

    fun chooseTile(row: Int, column: Int, swipeFrom: Pair<Int, Int>? = null) {
        val active = session ?: return
        gameHint = null
        if (selectedBooster != null) {
            useBooster(row, column)
            return
        }
        val first = swipeFrom ?: selected
        if (first == null || first == (row to column)) {
            selected = if (first == null) row to column else null
            return
        }
        if (kotlin.math.abs(first.first - row) + kotlin.math.abs(first.second - column) != 1) {
            selected = row to column
            return
        }
        scope.launch {
            busy = true
            error = null
            notice = null
            try {
                val result = withContext(Dispatchers.IO) {
                    Match3Api.move(token, active.id, first.first, first.second, row, column)
                }
                session = result.session
                selected = null
                if (result.accepted) {
                    gameProgress = withContext(Dispatchers.IO) { Match3Api.progress(token) }
                    if (result.pointsAwarded > 0) {
                        val gift = result.boosterAwarded?.let { id ->
                            gameProgress?.boosterCatalog?.firstOrNull { it.id == id }?.name
                        }
                        notice = "Уровень пройден! ${result.pointsAwarded} баллов готовы к получению.${gift?.let { " Подарок: $it." }.orEmpty()}"
                    }
                } else {
                    notice = "Обмен без совпадения — попробуйте соседние фишки."
                }
            } catch (failure: Exception) {
                error = failure.message ?: "Ход не сохранён. Попробуйте ещё раз."
            } finally {
                busy = false
            }
        }
    }

    fun chooseVisor(id: String) {
        scope.launch {
            busy = true
            error = null
            try {
                selectedVisor = withContext(Dispatchers.IO) { Match3Api.updateCosmetic(token, id) }
                notice = "Визор сохранён в аккаунте и будет доступен на других устройствах."
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось сохранить визор."
            } finally {
                busy = false
            }
        }
    }

    val completed = gameProgress?.completedCount ?: 0
    val story = if (session == null || session?.status == "COMPLETE") {
        chapterStories.firstOrNull { it.afterLevel == completed && it.afterLevel !in dismissedStories }
    } else null
    val showEpilogue = completed >= 100 && !epilogueDismissed
    val dialogueToSpeak = when {
        story != null -> story.dialogue
        showEpilogue -> RACCOON_EPILOGUE_DIALOGUE
        else -> null
    }

    LaunchedEffect(dialogueToSpeak, voiceEnabled) {
        if (voiceEnabled && dialogueToSpeak != null) {
            speech.speak(dialogueToSpeak)
        } else {
            speech.stop()
        }
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            TextButton(onClick = onBack) { Text("← Назад") }
            Text("Мастерская енота", fontSize = 21.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        }
        Text("Собери компьютер мечты: 100 уровней, пять глав и общий прогресс аккаунта.", fontSize = 13.sp, lineHeight = 19.sp, color = UtpMuted)
        OutlinedButton(onClick = onDailyPuzzle, modifier = Modifier.fillMaxWidth()) {
            Text("📅 Испытание дня · отдельно от кампании")
        }

        error?.let { message ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text(message, color = MaterialTheme.colorScheme.onErrorContainer)
                    TextButton(onClick = { reloadVersion += 1 }) { Text("Повторить загрузку") }
                }
            }
        }
        notice?.let { message ->
            Card(colors = CardDefaults.cardColors(containerColor = UtpMint)) {
                Text(message, modifier = Modifier.padding(12.dp), color = UtpInk, fontSize = 13.sp)
            }
        }

        if (loading) {
            Text("Загружаю сохранённую игру…", color = UtpMuted, modifier = Modifier.padding(vertical = 24.dp))
        }
        gameProgress?.let { snapshot ->
            Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("🦝 Кампания", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                    Text("Пройдено $completed из 100 · заработано ${snapshot.totalGamePoints} баллов · к получению ${snapshot.pendingGamePoints}", fontSize = 13.sp, color = UtpMuted)
                    LinearProgressIndicator(
                        progress = { completed / 100f },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            Match3EconomyPanel(
                progress = snapshot,
                selectedBooster = selectedBooster,
                canUseBoosters = session?.status == "ACTIVE" && story == null && !showEpilogue,
                busy = busy,
                onClaim = ::claimGamePoints,
                onCraft = ::craftBooster,
                onSelectBooster = { selectedBooster = it },
            )

            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = UtpMint)) {
                Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Чертёж компьютера", fontWeight = FontWeight.Bold, color = UtpInk)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        listOf("🖥️" to 20, "🟩" to 40, "🧠" to 60, "🌀" to 80, "⚡" to 100).forEach { (icon, milestone) ->
                            Text(if (completed >= milestone) "$icon ✓" else "$icon ·", fontSize = 17.sp, color = UtpInk)
                        }
                    }
                    Text("Детали загораются по мере прохождения глав.", fontSize = 12.sp, color = UtpMuted)
                }
            }

            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Визор енота", fontWeight = FontWeight.Bold, color = UtpInk)
                    Text("Выбор хранится в аккаунте и синхронизируется между устройствами.", fontSize = 12.sp, color = UtpMuted)
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        visors.forEach { visor ->
                            val unlocked = completed >= visor.unlockAt
                            OutlinedButton(
                                onClick = { chooseVisor(visor.id) },
                                enabled = unlocked && selectedVisor != visor.id && !busy,
                            ) {
                                Text("${visor.icon} ${visor.title}${if (unlocked) "" else " · ${visor.unlockAt}"}")
                            }
                        }
                    }
                }
            }

            story?.let { scene ->
                Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = UtpMint)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Глава ${(scene.afterLevel / 20) + 1} · ${scene.chapter}", fontWeight = FontWeight.Bold, color = UtpInk)
                        Text(scene.narration, fontSize = 13.sp, lineHeight = 19.sp, color = UtpMuted)
                        RaccoonDialogueControls(
                            dialogue = scene.dialogue,
                            voiceEnabled = voiceEnabled,
                            speechAvailable = speechAvailable,
                            isSpeaking = isSpeaking,
                            onVoiceEnabledChange = ::setVoiceEnabled,
                            onRepeat = { repeatRaccoonLine(scene.dialogue) },
                        )
                        TextButton(onClick = { dismissedStories = dismissedStories + scene.afterLevel }) { Text("Продолжить") }
                    }
                }
            }

            if (showEpilogue) {
                Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = UtpMint)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Компьютер ожил!", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                        Text("Последняя деталь встаёт на место, и мастерскую озаряет мягкий свет. Енот улыбается: его компьютер собран — от первого корпуса до последнего провода.", fontSize = 13.sp, lineHeight = 19.sp, color = UtpMuted)
                        RaccoonDialogueControls(
                            dialogue = RACCOON_EPILOGUE_DIALOGUE,
                            voiceEnabled = voiceEnabled,
                            speechAvailable = speechAvailable,
                            isSpeaking = isSpeaking,
                            onVoiceEnabledChange = ::setVoiceEnabled,
                            onRepeat = { repeatRaccoonLine(RACCOON_EPILOGUE_DIALOGUE) },
                        )
                        TextButton(onClick = { epilogueDismissed = true }) { Text("В мастерскую") }
                    }
                }
            }

            val active = session
            if (active?.status == "ACTIVE") {
                Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Уровень ${active.level.number} · ${active.level.chapter.title}", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                        Text("Собери ${active.level.targetPartIcon} ${active.level.targetPartName}: ${active.targetCollected} / ${active.level.targetCount}", fontSize = 13.sp, color = UtpMuted)
                        LinearProgressIndicator(
                            progress = { (active.targetCollected.toFloat() / active.level.targetCount.coerceAtLeast(1)).coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedButton(
                                onClick = ::showMoveHint,
                                enabled = !busy && active.status == "ACTIVE",
                                modifier = Modifier.weight(1f),
                            ) {
                                Text("❔ Подсказка")
                            }
                            OutlinedButton(
                                onClick = ::restartLevel,
                                enabled = !busy && active.status == "ACTIVE",
                                modifier = Modifier.weight(1f),
                            ) {
                                Text("Начать заново")
                            }
                        }
                        Text(
                            "Перезапускается только этот уровень; пройденные этапы и награды сохраняются.",
                            fontSize = 12.sp,
                            color = UtpMuted,
                        )
                        Match3Board(
                            active.board,
                            selected,
                            !busy && active.status == "ACTIVE",
                            onTileSelected = { row, column -> chooseTile(row, column) },
                            onTileSwiped = { fromRow, fromColumn, toRow, toColumn ->
                                chooseTile(toRow, toColumn, fromRow to fromColumn)
                            },
                            swipingEnabled = selectedBooster == null,
                            hint = gameHint,
                        )
                        Text(
                            if (selectedBooster != null) "Нажмите клетку, чтобы применить бустер."
                            else "Осталось ходов: ${active.level.moveLimit - active.movesUsed}. Выберите соседние фишки для обмена.",
                            fontSize = 12.sp,
                            color = UtpMuted,
                        )
                    }
                }
            } else if (active?.status == "COMPLETE") {
                Card(colors = CardDefaults.cardColors(containerColor = UtpMint)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Уровень ${active.level.number} пройден!", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                        Text("Награду за это прохождение можно забрать кнопкой «Забрать баллы». При повторном прохождении награды выдаются снова.", fontSize = 13.sp, color = UtpMuted)
                        if (completed < 100) Button(onClick = ::startLevel, enabled = !busy) { Text("Следующий уровень · ${completed + 1}") }
                        Button(onClick = ::restartLevel, enabled = !busy) { Text("Начать заново") }
                    }
                }
            } else if (active?.status == "FAILED") {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Попробуем ещё раз?", fontWeight = FontWeight.Bold, color = UtpInk)
                        Text("Начните уровень заново — прохождение кампании не изменится.", fontSize = 13.sp, color = UtpMuted)
                        Button(onClick = ::startLevel, enabled = !busy) { Text("Начать заново") }
                    }
                }
            } else if (snapshot.currentLevel != null) {
                Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Глава ${snapshot.levels.firstOrNull { it.number == snapshot.currentLevel }?.chapter?.number ?: 1}", color = UtpBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("Уровень ${snapshot.currentLevel} из 100", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                        Text(snapshot.levels.firstOrNull { it.number == snapshot.currentLevel }?.chapter?.description.orEmpty(), fontSize = 13.sp, lineHeight = 18.sp, color = UtpMuted)
                        Button(onClick = ::startLevel, enabled = !busy) { Text("Начать игру") }
                    }
                }
            } else if (completed >= 100) {
                Text("Все 100 уровней пройдены — енот уже собрал компьютер мечты!", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

