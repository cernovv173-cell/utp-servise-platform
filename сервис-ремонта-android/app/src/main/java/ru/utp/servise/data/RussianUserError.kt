package ru.utp.servise.data

private const val CYRILLIC_START = '\u0400'
private const val CYRILLIC_END = '\u04FF'

fun russianUserError(message: String?, fallback: String): String {
    val text = message?.trim().orEmpty()
    if (text.isBlank()) return fallback
    if (text.any { it in CYRILLIC_START..CYRILLIC_END }) return text

    val normalized = text.lowercase()
    return when {
        listOf("failed to fetch", "failed to connect", "network", "timed out", "timeout", "unknownhost", "unable to resolve", "connection refused")
            .any(normalized::contains) -> "Не удалось подключиться к серверу. Проверьте интернет и повторите попытку."
        listOf("unauthorized", "invalid credentials", "incorrect password", "authentication required")
            .any(normalized::contains) -> "Не удалось войти. Проверьте данные и попробуйте ещё раз."
        listOf("forbidden", "access denied", "permission denied")
            .any(normalized::contains) -> "Недостаточно прав для этого действия."
        listOf("not found", "does not exist", "no longer exists")
            .any(normalized::contains) -> "Не удалось найти эти данные. Обновите экран и попробуйте ещё раз."
        listOf("invalid", "is required", "must be", "validation")
            .any(normalized::contains) -> "Проверьте введённые данные и попробуйте ещё раз."
        else -> fallback
    }
}
