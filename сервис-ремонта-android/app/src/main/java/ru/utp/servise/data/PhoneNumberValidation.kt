package ru.utp.servise.data

private val phoneNumberPattern = Regex("^[+0-9().\\-\\s]+$")

internal fun phoneNumberValidationError(value: String, required: Boolean = true): String? {
    val phoneNumber = value.trim()
    if (phoneNumber.isEmpty()) {
        return if (required) "Укажите номер телефона." else null
    }
    val digitCount = phoneNumber.count { it in '0'..'9' }
    return when {
        phoneNumber.length > 32 -> "Номер телефона слишком длинный."
        !phoneNumberPattern.matches(phoneNumber) -> "Введите корректный номер телефона."
        digitCount !in 7..15 -> "Введите корректный номер телефона."
        else -> null
    }
}
