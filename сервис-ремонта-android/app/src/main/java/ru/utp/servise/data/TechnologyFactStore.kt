package ru.utp.servise.data

import android.content.Context

class TechnologyFactStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    fun previousFactId(): String? = preferences.getString(LAST_FACT_ID_KEY, null)

    fun rememberFact(factId: String) {
        preferences.edit().putString(LAST_FACT_ID_KEY, factId).apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "technology-facts"
        const val LAST_FACT_ID_KEY = "last-shown-fact-id"
    }
}
