package ru.utp.servise.data

import android.content.Context

data class AdminQuickActionPosition(
    val xFraction: Float = 1f,
    val yFraction: Float = 1f,
) {
    fun draggedBy(deltaX: Float, deltaY: Float, maxX: Float, maxY: Float): AdminQuickActionPosition =
        copy(
            xFraction = if (maxX > 0f) (xFraction + deltaX / maxX).coerceIn(0f, 1f) else xFraction,
            yFraction = if (maxY > 0f) (yFraction + deltaY / maxY).coerceIn(0f, 1f) else yFraction,
        )
}

class AdminQuickActionPreferences(context: Context, private val userId: String) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )
    private val keyPrefix = "admin_quick_action_$userId"

    fun isVisible(): Boolean = preferences.getBoolean("${keyPrefix}_visible", true)

    fun setVisible(visible: Boolean) {
        preferences.edit().putBoolean("${keyPrefix}_visible", visible).apply()
    }

    fun position(): AdminQuickActionPosition = AdminQuickActionPosition(
        xFraction = preferences.getFloat("${keyPrefix}_x", 1f).coerceIn(0f, 1f),
        yFraction = preferences.getFloat("${keyPrefix}_y", 1f).coerceIn(0f, 1f),
    )

    fun savePosition(position: AdminQuickActionPosition) {
        preferences.edit()
            .putFloat("${keyPrefix}_x", position.xFraction.coerceIn(0f, 1f))
            .putFloat("${keyPrefix}_y", position.yFraction.coerceIn(0f, 1f))
            .apply()
    }

    fun resetPosition(): AdminQuickActionPosition = AdminQuickActionPosition().also(::savePosition)

    private companion object {
        const val PREFERENCES_NAME = "utp_app_settings"
    }
}
