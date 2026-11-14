package ru.utp.servise.data

import org.junit.Assert.assertEquals
import org.junit.Test

class RussianUserErrorTest {
    @Test
    fun translatesEnglishNetworkFailures() {
        assertEquals(
            "Не удалось подключиться к серверу. Проверьте интернет и повторите попытку.",
            russianUserError("Failed to fetch", "Повторите попытку."),
        )
    }

    @Test
    fun preservesActionableRussianServerErrors() {
        assertEquals(
            "Сначала завершите заказ.",
            russianUserError("Сначала завершите заказ.", "Не удалось выполнить запрос."),
        )
    }

    @Test
    fun replacesUnknownNonRussianFailuresWithRussianFallback() {
        assertEquals(
            "Не удалось выполнить запрос.",
            russianUserError("Unexpected exception", "Не удалось выполнить запрос."),
        )
    }
}
