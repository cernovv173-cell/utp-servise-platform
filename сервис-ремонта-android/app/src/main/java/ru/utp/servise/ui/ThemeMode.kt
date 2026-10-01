package ru.utp.servise.ui

import android.content.Context

enum class ThemeMode(val title: String) {
    SYSTEM("Как в системе"),
    LIGHT("Светлая"),
    DARK("Тёмная"),
}

private const val PREFERENCES_NAME = "utp_app_settings"
private const val THEME_MODE_KEY = "theme_mode"

fun readThemeMode(context: Context): ThemeMode = runCatching {
    ThemeMode.valueOf(
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .getString(THEME_MODE_KEY, ThemeMode.SYSTEM.name)
            ?: ThemeMode.SYSTEM.name,
    )
}.getOrDefault(ThemeMode.SYSTEM)

fun saveThemeMode(context: Context, mode: ThemeMode) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(THEME_MODE_KEY, mode.name)
        .apply()
}
