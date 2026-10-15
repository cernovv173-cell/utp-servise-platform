package ru.utp.servise.data

import org.json.JSONArray
import org.json.JSONObject

data class Match3Chapter(
    val number: Int,
    val firstLevel: Int,
    val lastLevel: Int,
    val title: String,
    val setting: String,
    val description: String,
)

data class Match3Level(
    val id: String,
    val number: Int,
    val title: String,
    val targetPart: String,
    val targetPartName: String,
    val targetPartIcon: String,
    val targetCount: Int,
    val moveLimit: Int,
    val chapter: Match3Chapter,
    val isCompleted: Boolean = false,
    val isUnlocked: Boolean = false,
    val pointsAwarded: Int = 0,
)

data class Match3Tile(
    val kind: String?,
    val frozen: Boolean,
    val junk: Boolean,
    val anomalyTurns: Int?,
)

data class Match3Session(
    val id: String,
    val board: List<List<Match3Tile>>,
    val targetCollected: Int,
    val movesUsed: Int,
    val status: String,
    val level: Match3Level,
)

data class Match3Progress(
    val levels: List<Match3Level>,
    val completedCount: Int,
    val currentLevel: Int?,
    val totalGamePoints: Int,
    val maximumGamePoints: Int,
    val activeSession: Match3Session?,
)

data class Match3MoveResult(
    val accepted: Boolean,
    val targetMatched: Int,
    val pointsAwarded: Int,
    val gameComplete: Boolean,
    val session: Match3Session,
)

object Match3Api {
    fun progress(token: String): Match3Progress =
        ApiClient.request("GET", "/game/match3/progress", token).toMatch3Progress()

    fun start(token: String): Match3Session =
        ApiClient.request("POST", "/game/match3/start", token, JSONObject())
            .getJSONObject("session").toMatch3Session()

    fun move(token: String, sessionId: String, fromRow: Int, fromColumn: Int, toRow: Int, toColumn: Int): Match3MoveResult {
        val body = JSONObject()
            .put("sessionId", sessionId)
            .put("from", JSONObject().put("row", fromRow).put("column", fromColumn))
            .put("to", JSONObject().put("row", toRow).put("column", toColumn))
        val json = ApiClient.request("POST", "/game/match3/move", token, body)
        return Match3MoveResult(
            accepted = json.optBoolean("accepted"),
            targetMatched = json.optInt("targetMatched"),
            pointsAwarded = json.optInt("pointsAwarded"),
            gameComplete = json.optBoolean("gameComplete"),
            session = json.getJSONObject("session").toMatch3Session(),
        )
    }

    fun selectedCosmetic(token: String): String? = ApiClient.request(
        "GET", "/game/match3/cosmetic", token,
    ).optString("selectedCosmeticId").takeUnless { it.isBlank() || it == "null" }

    fun initializeCosmetic(token: String, id: String): String = cosmeticRequest(
        "POST", "/game/match3/cosmetic/initialize", token, id,
    )

    fun updateCosmetic(token: String, id: String): String = cosmeticRequest(
        "PUT", "/game/match3/cosmetic", token, id,
    )

    private fun cosmeticRequest(method: String, path: String, token: String, id: String): String =
        ApiClient.request(method, path, token, JSONObject().put("cosmeticId", id))
            .getString("selectedCosmeticId")
}

private fun JSONObject.toMatch3Progress() = Match3Progress(
    levels = getJSONArray("levels").objects().map { it.toMatch3Level() },
    completedCount = optInt("completedCount"),
    currentLevel = if (isNull("currentLevel")) null else optInt("currentLevel"),
    totalGamePoints = optInt("totalGamePoints"),
    maximumGamePoints = optInt("maximumGamePoints"),
    activeSession = if (isNull("activeSession")) null else getJSONObject("activeSession").toMatch3Session(),
)

private fun JSONObject.toMatch3Session(): Match3Session {
    val rows = getJSONArray("board").values().mapNotNull { it?.toMatch3TileRow() }
    return Match3Session(
        id = getString("id"),
        board = rows,
        targetCollected = optInt("targetCollected"),
        movesUsed = optInt("movesUsed"),
        status = optString("status"),
        level = getJSONObject("level").toMatch3Level(),
    )
}

private fun JSONObject.toMatch3Tile() = Match3Tile(
    kind = optString("kind").takeUnless { it.isBlank() || it == "null" },
    frozen = optBoolean("frozen"),
    junk = optBoolean("junk"),
    anomalyTurns = if (isNull("anomalyTurns")) null else optInt("anomalyTurns"),
)

private fun Any.toMatch3TileRow(): List<Match3Tile> =
    (this as? JSONArray)?.values()?.mapNotNull { (it as? JSONObject)?.toMatch3Tile() }.orEmpty()

private fun JSONObject.toMatch3Level(): Match3Level {
    val chapterJson = optJSONObject("chapter") ?: JSONObject()
    return Match3Level(
        id = optString("id"),
        number = optInt("number"),
        title = optString("title"),
        targetPart = optString("targetPart"),
        targetPartName = optString("targetPartName"),
        targetPartIcon = optString("targetPartIcon"),
        targetCount = optInt("targetCount"),
        moveLimit = optInt("moveLimit"),
        chapter = Match3Chapter(
            number = chapterJson.optInt("number"),
            firstLevel = chapterJson.optInt("firstLevel"),
            lastLevel = chapterJson.optInt("lastLevel"),
            title = chapterJson.optString("title"),
            setting = chapterJson.optString("setting"),
            description = chapterJson.optString("description"),
        ),
        isCompleted = optBoolean("isCompleted"),
        isUnlocked = optBoolean("isUnlocked"),
        pointsAwarded = optInt("pointsAwarded"),
    )
}

private fun JSONArray.objects(): List<JSONObject> =
    (0 until length()).mapNotNull { optJSONObject(it) }

private fun JSONArray.values(): List<Any?> = (0 until length()).map { index -> opt(index) }
