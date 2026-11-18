package ru.utp.servise.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class RepairWorkActCatalogShortcuts(
    val favoriteIds: List<String> = emptyList(),
    val recentIds: List<String> = emptyList(),
)

private const val PREFERENCES_NAME = "utp_repair_work_act_catalog"
private const val MAX_RECENT_ITEMS = 8

fun toggleRepairCatalogFavorite(favoriteIds: List<String>, itemId: String): List<String> =
    if (itemId in favoriteIds) favoriteIds.filterNot { it == itemId } else listOf(itemId) + favoriteIds

fun recordRecentRepairCatalogItem(recentIds: List<String>, itemId: String): List<String> =
    (listOf(itemId) + recentIds.filterNot { it == itemId }).take(MAX_RECENT_ITEMS)

fun filterRepairWorkActCatalogItems(
    items: List<CatalogItem>,
    mode: String,
    typeFilter: String,
    query: String,
    shortcuts: RepairWorkActCatalogShortcuts,
): List<CatalogItem> {
    val byId = items.associateBy(CatalogItem::id)
    val source = when (mode) {
        "FAVORITES" -> shortcuts.favoriteIds.mapNotNull(byId::get)
        "RECENT" -> shortcuts.recentIds.mapNotNull(byId::get)
        else -> items
    }
    val normalizedQuery = query.trim().lowercase()
    return source.filter { item ->
        (typeFilter == "ALL" ||
            (typeFilter == "SOFTWARE" && item.type == "SERVICE" && item.serviceCategory == "SOFTWARE") ||
            (typeFilter == "SERVICE" && item.type == "SERVICE" && item.serviceCategory != "SOFTWARE") ||
            (typeFilter != "SOFTWARE" && typeFilter != "SERVICE" && item.type == typeFilter)) &&
            (normalizedQuery.isEmpty() ||
                "${item.name} ${item.description.orEmpty()}".lowercase().contains(normalizedQuery))
    }
}

fun readRepairWorkActCatalogShortcuts(context: Context, userId: String): RepairWorkActCatalogShortcuts {
    if (userId.isBlank()) return RepairWorkActCatalogShortcuts()
    val saved = context.applicationContext
        .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .getString(userId, null)
        ?: return RepairWorkActCatalogShortcuts()
    return runCatching {
        val json = JSONObject(saved)
        RepairWorkActCatalogShortcuts(
            favoriteIds = json.optJSONArray("favoriteIds").toIds(),
            recentIds = json.optJSONArray("recentIds").toIds().take(MAX_RECENT_ITEMS),
        )
    }.getOrDefault(RepairWorkActCatalogShortcuts())
}

fun saveRepairWorkActCatalogShortcuts(
    context: Context,
    userId: String,
    shortcuts: RepairWorkActCatalogShortcuts,
) {
    if (userId.isBlank()) return
    val json = JSONObject()
        .put("favoriteIds", JSONArray(shortcuts.favoriteIds.distinct()))
        .put("recentIds", JSONArray(shortcuts.recentIds.distinct().take(MAX_RECENT_ITEMS)))
    context.applicationContext
        .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(userId, json.toString())
        .apply()
}

private fun JSONArray?.toIds(): List<String> {
    if (this == null) return emptyList()
    return (0 until length())
        .mapNotNull { index -> optString(index).takeIf(String::isNotBlank) }
        .distinct()
}
