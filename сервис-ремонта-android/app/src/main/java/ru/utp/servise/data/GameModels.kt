package ru.utp.servise.data

data class GameOption(val id: String, val text: String)

data class GameQuestion(
    val id: String,
    val prompt: String,
    val correctFeedback: String,
    val incorrectFeedback: String,
    val options: List<GameOption>,
)

data class GameEpisode(
    val id: String,
    val title: String,
    val introduction: String,
    val completed: Boolean,
    val questions: List<GameQuestion>,
)

data class GameEpisodesResponse(
    val episodes: List<GameEpisode>,
    val balance: Int,
    val weeklyAwardedPoints: Int,
    val weeklyLimit: Int,
    val pointsPerEpisode: Int,
)

data class GameAnswerCheck(val correct: Boolean, val feedback: String)

data class GameCompletionResult(
    val awardedPoints: Int,
    val balance: Int,
    val weeklyAwardedPoints: Int,
    val alreadyCompleted: Boolean,
    val weeklyLimitReached: Boolean,
)
