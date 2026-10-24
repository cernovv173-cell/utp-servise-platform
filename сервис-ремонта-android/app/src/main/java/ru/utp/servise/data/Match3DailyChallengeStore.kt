package ru.utp.servise.data

import android.content.Context

private const val DAILY_CHALLENGE_PREFERENCES = "match3_daily_challenge_v1"

// Retained only to clear a completion marker stored by older app versions on account deletion.
fun clearDailyChallengeCompletion(context: Context, customerId: String) {
    context.getSharedPreferences(DAILY_CHALLENGE_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .remove(customerId)
        .apply()
}
