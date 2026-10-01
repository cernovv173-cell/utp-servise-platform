package ru.utp.servise.data

import org.json.JSONArray
import org.json.JSONObject

data class CompanySocial(val label: String, val url: String)

data class CompanyInfo(
    val name: String,
    val description: String,
    val history: String,
    val services: List<String>,
    val phone: String,
    val email: String,
    val address: String,
    val hours: String,
    val socials: List<CompanySocial>,
    val requisites: String,
    val mediaUrls: List<String>,
)

internal fun JSONObject.toCompanyInfo() = CompanyInfo(
    name = optString("name"),
    description = optString("description"),
    history = optString("history"),
    services = optJSONArray("services").toStringList(),
    phone = optString("phone"),
    email = optString("email"),
    address = optString("address"),
    hours = optString("hours"),
    socials = (optJSONArray("socials") ?: JSONArray()).mapObjects { item ->
        CompanySocial(item.optString("label"), item.optString("url"))
    },
    requisites = optString("requisites"),
    mediaUrls = optJSONArray("mediaUrls").toStringList(),
)

internal fun CompanyInfo.toRequestJson() = JSONObject()
    .put("name", name)
    .put("description", description)
    .put("history", history)
    .put("services", JSONArray(services))
    .put("phone", phone)
    .put("email", email)
    .put("address", address)
    .put("hours", hours)
    .put("socials", JSONArray().apply {
        socials.forEach { item -> put(JSONObject().put("label", item.label).put("url", item.url)) }
    })
    .put("requisites", requisites)
    .put("mediaUrls", JSONArray(mediaUrls))

private fun JSONArray?.toStringList(): List<String> =
    this?.let { values -> (0 until values.length()).mapNotNull { values.optString(it) } }.orEmpty()

private inline fun <T> JSONArray.mapObjects(transform: (JSONObject) -> T): List<T> =
    (0 until length()).mapNotNull { index -> optJSONObject(index)?.let(transform) }
