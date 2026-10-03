package ru.utp.servise.ui

import android.content.Context

enum class WelcomeAnimationMode(
    val title: String,
    val description: String,
) {
    BOUNCE(
        title = "Динамичная",
        description = "Маскот появляется с лёгким пружинящим движением",
    ),
    FADE(
        title = "Спокойная",
        description = "Мягкое появление без покачивания",
    ),
    SLIDE_UP(
        title = "Снизу вверх",
        description = "Заставка плавно поднимается снизу",
    ),
    ZOOM(
        title = "Увеличение",
        description = "Маскот появляется с эффектом приближения",
    ),
    TURN(
        title = "Поворот",
        description = "Маскот плавно поворачивается при появлении",
    ),
    OFF(
        title = "Без заставки",
        description = "Сразу открыть приложение",
    ),
}

private const val PREFERENCES_NAME = "utp_app_settings"
private const val WELCOME_ANIMATION_MODE_KEY = "welcome_animation_mode"

fun readWelcomeAnimationMode(context: Context): WelcomeAnimationMode = runCatching {
    WelcomeAnimationMode.valueOf(
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .getString(WELCOME_ANIMATION_MODE_KEY, WelcomeAnimationMode.BOUNCE.name)
            ?: WelcomeAnimationMode.BOUNCE.name,
    )
}.getOrDefault(WelcomeAnimationMode.BOUNCE)

fun saveWelcomeAnimationMode(context: Context, mode: WelcomeAnimationMode) {
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(WELCOME_ANIMATION_MODE_KEY, mode.name)
        .apply()
}
