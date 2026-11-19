package ru.utp.servise.ui

internal fun String.shortTechnicianName(): String {
    val parts = trim().split(Regex("\\s+")).filter(String::isNotBlank)
    if (parts.size <= 1) return parts.firstOrNull().orEmpty()

    return (listOf(parts.first()) + parts.drop(1).mapNotNull { part ->
        part.trimEnd('.').firstOrNull()?.uppercaseChar()?.let { "$it." }
    }).joinToString(" ")
}
