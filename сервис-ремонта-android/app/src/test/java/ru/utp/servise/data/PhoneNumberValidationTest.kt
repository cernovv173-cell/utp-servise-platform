package ru.utp.servise.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PhoneNumberValidationTest {
    @Test
    fun `accepts formatted phone numbers with a valid digit count`() {
        assertNull(phoneNumberValidationError("+7 (999) 123-45-67"))
        assertNull(phoneNumberValidationError("+44 20 7946 0958"))
    }

    @Test
    fun `requires a phone number and rejects malformed values`() {
        assertEquals("Укажите номер телефона.", phoneNumberValidationError("  "))
        assertEquals("Введите корректный номер телефона.", phoneNumberValidationError("call-me"))
        assertEquals("Введите корректный номер телефона.", phoneNumberValidationError("+7 999"))
        assertEquals("Номер телефона слишком длинный.", phoneNumberValidationError("1".repeat(33)))
    }

    @Test
    fun `optional mode accepts an empty phone number`() {
        assertNull(phoneNumberValidationError("", required = false))
    }
}
