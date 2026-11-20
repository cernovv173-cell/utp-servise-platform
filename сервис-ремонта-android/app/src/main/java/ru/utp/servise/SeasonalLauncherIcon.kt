package ru.utp.servise

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.edit
import java.util.Locale

internal fun launcherAliasForSeason(season: String): String =
    when (season.uppercase(Locale.ROOT)) {
        "SPRING" -> "LauncherSpring"
        "SUMMER" -> "LauncherSummer"
        "AUTUMN" -> "LauncherAutumn"
        "WINTER" -> "LauncherWinter"
        else -> "LauncherDefault"
    }

internal object SeasonalLauncherIcon {
    private const val TAG = "SeasonalLauncherIcon"
    private const val PREFERENCES = "seasonal_launcher_icon"
    private const val ACTIVE_ALIAS_KEY = "active_alias"

    private val aliases = listOf(
        "LauncherDefault",
        "LauncherSpring",
        "LauncherSummer",
        "LauncherAutumn",
        "LauncherWinter",
    )

    fun apply(context: Context, season: String) {
        val activeAlias = launcherAliasForSeason(season)
        val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        if (preferences.getString(ACTIVE_ALIAS_KEY, null) == activeAlias) return

        runCatching {
            val packageManager = context.packageManager
            val componentPackage = MainActivity::class.java.name.substringBeforeLast('.')
            aliases.forEach { alias ->
                packageManager.setComponentEnabledSetting(
                    ComponentName(context.packageName, "$componentPackage.$alias"),
                    if (alias == activeAlias) {
                        PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    } else {
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                    },
                    PackageManager.DONT_KILL_APP,
                )
            }
            preferences.edit { putString(ACTIVE_ALIAS_KEY, activeAlias) }
        }.onFailure { error ->
            Log.w(TAG, "Could not apply the selected launcher icon", error)
        }
    }
}
