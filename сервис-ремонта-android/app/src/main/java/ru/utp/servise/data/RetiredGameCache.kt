package ru.utp.servise.data

import android.content.Context
import android.webkit.WebStorage
import android.webkit.WebView

private const val LEGACY_GAME_PREFERENCES = "match3_daily_challenge_v1"
private const val RETIRED_GAME_CACHE_PREFERENCES = "retired_game_cache_cleanup_v1"
private const val RETIRED_GAME_CACHE_CLEARED = "cleared"

fun clearRetiredGameCache(context: Context) {
    val migration = context.getSharedPreferences(RETIRED_GAME_CACHE_PREFERENCES, Context.MODE_PRIVATE)
    if (migration.getBoolean(RETIRED_GAME_CACHE_CLEARED, false)) return

    context.getSharedPreferences(LEGACY_GAME_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply()

    val webView = runCatching { WebView(context) }.getOrNull() ?: return
    val cleared = runCatching {
        webView.clearCache(true)
        webView.clearHistory()
        WebStorage.getInstance().deleteAllData()
    }.isSuccess
    runCatching { webView.destroy() }

    if (cleared) migration.edit().putBoolean(RETIRED_GAME_CACHE_CLEARED, true).apply()
}

