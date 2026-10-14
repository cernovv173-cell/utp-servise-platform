package ru.utp.servise.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.R
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.GameAnswerCheck
import ru.utp.servise.data.GameCompletionResult
import ru.utp.servise.data.GameEpisode
import ru.utp.servise.data.GameEpisodesResponse
import ru.utp.servise.data.GameOption
import ru.utp.servise.ui.UtpBlue
import ru.utp.servise.ui.UtpInk
import ru.utp.servise.ui.UtpMuted
import ru.utp.servise.ui.UtpPale

@Composable
fun CustomerGameScreen(
    token: String,
    onRefresh: () -> Unit,
    onCreateRequest: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var response by remember { mutableStateOf<GameEpisodesResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedEpisodeId by remember { mutableStateOf<String?>(null) }
    var questionIndex by remember { mutableStateOf(0) }
    var selectedOptionId by remember { mutableStateOf<String?>(null) }
    var answers by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var feedbackCorrect by remember { mutableStateOf(false) }
    var feedbackVersion by remember { mutableStateOf(0) }
    var completion by remember { mutableStateOf<GameCompletionResult?>(null) }
    val mascotY = remember { Animatable(0f) }
    val mascotX = remember { Animatable(0f) }

    LaunchedEffect(token) {
        loading = true
        error = null
        runCatching { withContext(Dispatchers.IO) { ApiClient.gameEpisodes(token) } }
            .onSuccess { response = it }
            .onFailure { error = it.message ?: "Не удалось загрузить задания." }
        loading = false
    }

    LaunchedEffect(feedbackVersion, feedbackCorrect) {
        if (feedbackVersion == 0) return@LaunchedEffect
        mascotX.snapTo(0f)
        mascotY.snapTo(0f)
        if (feedbackCorrect) {
            listOf(-16f, 0f, -11f, 0f).forEach { offset ->
                mascotY.animateTo(offset, tween(125))
            }
        } else {
            listOf(-9f, 9f, -6f, 0f).forEach { offset ->
                mascotX.animateTo(offset, tween(95))
            }
        }
    }

    val episode = response?.episodes?.firstOrNull { it.id == selectedEpisodeId }
    val question = episode?.questions?.getOrNull(questionIndex)
    val inspectionMode = LocalInspectionMode.current

    fun resetGame() {
        selectedEpisodeId = null
        questionIndex = 0
        selectedOptionId = null
        answers = emptyList()
        feedback = null
        feedbackCorrect = false
        feedbackVersion = 0
        completion = null
        error = null
    }

    fun submitAnswer(option: GameOption) {
        val selectedEpisode = episode ?: return
        val selectedQuestion = question ?: return
        selectedOptionId = option.id
        feedback = null
        error = null
        busy = true
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    ApiClient.checkGameAnswer(token, selectedEpisode.id, selectedQuestion.id, option.id)
                }
                feedback = result.feedback
                feedbackCorrect = result.correct
                feedbackVersion += 1
                if (result.correct) {
                    answers = answers.filterNot { it.first == selectedQuestion.id } + (selectedQuestion.id to option.id)
                }
            } catch (failure: Throwable) {
                error = failure.message ?: "Не удалось проверить ответ. Попробуйте ещё раз."
            } finally {
                busy = false
            }
        }
    }

    fun continueEpisode() {
        val selectedEpisode = episode ?: return
        if (questionIndex < selectedEpisode.questions.lastIndex) {
            questionIndex += 1
            selectedOptionId = null
            feedback = null
            feedbackCorrect = false
            error = null
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                completion = withContext(Dispatchers.IO) {
                    ApiClient.completeGameEpisode(token, selectedEpisode.id, answers)
                }
                response = response?.copy(
                    balance = completion?.balance ?: response!!.balance,
                    weeklyAwardedPoints = completion?.weeklyAwardedPoints ?: response!!.weeklyAwardedPoints,
                    episodes = response!!.episodes.map {
                        if (it.id == selectedEpisode.id) it.copy(completed = true) else it
                    },
                )
                onRefresh()
            } catch (failure: Throwable) {
                error = failure.message ?: "Не удалось сохранить прохождение. Попробуйте ещё раз."
            } finally {
                busy = false
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("КиберМастерская", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Помогите еноту-мастеру разобраться в компьютерной технике и получите бонусные баллы.", fontSize = 14.sp, lineHeight = 21.sp, color = UtpMuted)

        when {
            loading -> Text("Загружаем игровые задания…", color = UtpMuted)
            error != null && response == null -> {
                Text(error.orEmpty(), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { response = null; loading = true; error = null; scope.launch { runCatching { withContext(Dispatchers.IO) { ApiClient.gameEpisodes(token) } }.onSuccess { response = it }.onFailure { error = it.message }.also { loading = false } } }) { Text("Повторить") }
            }
            completion != null -> GameCompletionCard(
                completion = completion!!,
                weeklyLimit = response?.weeklyLimit ?: 50,
                onReturn = ::resetGame,
                onCreateRequest = onCreateRequest,
            )
            episode != null && question != null -> {
                OutlinedButton(onClick = ::resetGame, enabled = !busy) { Text("‹  Все задания") }
                Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                        Text(episode.title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text("Вопрос ${questionIndex + 1} из ${episode.questions.size}", fontSize = 12.sp, color = UtpMuted)
                        Text(question.prompt, fontSize = 19.sp, lineHeight = 27.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                        question.options.forEachIndexed { index, option ->
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = when {
                                        selectedOptionId == option.id && feedbackCorrect -> androidx.compose.ui.graphics.Color(0xFFE5F6EA)
                                        selectedOptionId == option.id && feedback != null -> androidx.compose.ui.graphics.Color(0xFFFFEFEE)
                                        else -> androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant
                                    },
                                ),
                                modifier = Modifier.fillMaxWidth().clickable(enabled = !busy && !feedbackCorrect) { submitAnswer(option) },
                            ) {
                                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text("${('A'.code + index).toChar()}.", fontWeight = FontWeight.Bold, color = UtpBlue)
                                    Text(option.text, Modifier.weight(1f).padding(start = 10.dp), fontSize = 14.sp, lineHeight = 20.sp, color = UtpInk)
                                }
                            }
                        }
                        if (busy) Text("Енот проверяет ответ…", fontSize = 13.sp, color = UtpMuted)
                        if (feedback != null) {
                            Text(
                                feedback.orEmpty() + if (feedbackCorrect) "" else "\nОтвет неверный — попробуйте ещё раз.",
                                fontSize = 14.sp,
                                lineHeight = 21.sp,
                                color = if (feedbackCorrect) androidx.compose.ui.graphics.Color(0xFF16753B) else androidx.compose.material3.MaterialTheme.colorScheme.error,
                            )
                        }
                        if (feedbackCorrect) Button(onClick = ::continueEpisode, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                            Text(if (questionIndex == episode.questions.lastIndex) "Завершить сценарий" else "Дальше")
                        }
                        if (error != null) Text(error.orEmpty(), color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    }
                }
                Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        AnimatedContent(
                            targetState = feedbackVersion to feedbackCorrect,
                            transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(110)) },
                            label = "mascot-reaction",
                        ) { (version, correct) ->
                            val resource = if (version > 0 && feedback != null && !correct) R.drawable.game_raccoon_sad else R.drawable.game_raccoon_happy
                            Image(
                                painter = painterResource(resource),
                                contentDescription = when {
                                    version == 0 -> "Енот-мастер готов к игре"
                                    correct -> "Енот улыбается и хлопает в ладоши"
                                    else -> "Енот огорчён неверным ответом"
                                },
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(230.dp).clip(RoundedCornerShape(18.dp)).graphicsLayer {
                                    translationY = mascotY.value
                                    translationX = mascotX.value
                                },
                            )
                        }
                        Text(
                            when {
                                feedback == null -> "Выберите ответ — енот подождёт."
                                feedbackCorrect -> "Верно! Енот улыбается и хлопает!"
                                else -> "Енот хмурится: ответ пока неверный."
                            },
                            Modifier.padding(top = 8.dp),
                            fontSize = 13.sp,
                            color = UtpMuted,
                        )
                    }
                }
            }
            else -> {
                val gameData = response
                if (gameData != null) {
                    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("★  Бонусные баллы", fontWeight = FontWeight.Bold, color = UtpBlue)
                            Text("Баланс: ${gameData.balance} · За неделю: ${gameData.weeklyAwardedPoints} из ${gameData.weeklyLimit}", Modifier.padding(top = 7.dp), fontSize = 13.sp, color = UtpMuted)
                            Text("За первое правильное прохождение — ${gameData.pointsPerEpisode} баллов. Повторная награда за один эпизод не выдаётся.", Modifier.padding(top = 7.dp), fontSize = 12.sp, lineHeight = 18.sp, color = UtpMuted)
                        }
                    }
                    if (gameData.episodes.isEmpty()) {
                        Text("Енот готовит новые истории. Загляните сюда позже!", color = UtpMuted)
                    }
                    gameData.episodes.forEach { item ->
                        Card(
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                            modifier = Modifier.fillMaxWidth().clickable(enabled = !item.completed) {
                                selectedEpisodeId = item.id
                                questionIndex = 0
                                selectedOptionId = null
                                answers = emptyList()
                                feedback = null
                                feedbackVersion = 0
                                completion = null
                            },
                        ) {
                            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(item.title, Modifier.weight(1f), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                                    if (item.completed) Text("Пройдено", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = androidx.compose.ui.graphics.Color(0xFF16753B))
                                }
                                Text(item.introduction, Modifier.padding(top = 7.dp), fontSize = 13.sp, lineHeight = 19.sp, color = UtpMuted)
                                Text(if (item.completed) "Награда уже получена" else "${item.questions.size} вопросов · +${gameData.pointsPerEpisode} баллов", Modifier.padding(top = 8.dp), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = UtpBlue)
                                if (!item.completed) Button(onClick = {
                                    selectedEpisodeId = item.id
                                    questionIndex = 0
                                    answers = emptyList()
                                    selectedOptionId = null
                                    feedback = null
                                    feedbackVersion = 0
                                    completion = null
                                }, modifier = Modifier.padding(top = 10.dp)) { Text("Играть") }
                            }
                        }
                    }
                } else if (!inspectionMode) {
                    Text("Не удалось загрузить игровые задания.", color = UtpMuted)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun GameCompletionCard(
    completion: GameCompletionResult,
    weeklyLimit: Int,
    onReturn: () -> Unit,
    onCreateRequest: () -> Unit,
) {
    Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Image(
                painterResource(R.drawable.game_raccoon_happy),
                "Енот улыбается и хлопает в ладоши",
                Modifier.size(230.dp).clip(RoundedCornerShape(20.dp)),
                contentScale = ContentScale.Crop,
            )
            Text("Отличная работа!", Modifier.padding(top = 12.dp), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                when {
                    completion.awardedPoints > 0 -> "+${completion.awardedPoints} бонусных баллов · баланс ${completion.balance}"
                    completion.alreadyCompleted -> "Сценарий уже был пройден — повторные награды не начисляются."
                    else -> "Недельный лимит $weeklyLimit уже достигнут; дополнительная награда не начислена."
                },
                Modifier.padding(top = 7.dp),
                fontSize = 14.sp,
                color = UtpMuted,
            )
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = onReturn, modifier = Modifier.weight(1f)) { Text("К заданиям") }
                Button(onClick = onCreateRequest, modifier = Modifier.weight(1f)) { Text("Создать заявку") }
            }
        }
    }
}
