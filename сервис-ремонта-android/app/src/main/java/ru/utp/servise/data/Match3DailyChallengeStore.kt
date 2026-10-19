package ru.utp.servise.data

import android.content.Context

private const val DAILY_CHALLENGE_PREFERENCES = "match3_daily_challenge_v1"

fun readDailyChallengeCompletion(context: Context, customerId: String): String? =
    context.getSharedPreferences(DAILY_CHALLENGE_PREFERENCES, Context.MODE_PRIVATE)
        .getString(customerId, null)

fun saveDailyChallengeCompletion(
    context: Context,
    customerId: String,
    dayKey: String,
) {
    context.getSharedPreferences(DAILY_CHALLENGE_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .putString(customerId, dayKey)
        .apply()
}

fun clearDailyChallengeCompletion(context: Context, customerId: String) {
    context.getSharedPreferences(DAILY_CHALLENGE_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .remove(customerId)
        .apply()
}
