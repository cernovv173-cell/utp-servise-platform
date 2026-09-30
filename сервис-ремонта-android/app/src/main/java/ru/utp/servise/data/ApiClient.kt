package ru.utp.servise.data

import org.json.JSONArray
import org.json.JSONObject
import ru.utp.servise.BuildConfig
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class AppUser(
    val id: String,
    val email: String,
    val displayName: String,
    val role: String,
    val mustChangePassword: Boolean,
)

data class RepairOrder(
    val id: String,
    val deviceType: String,
    val problem: String,
    val address: String,
    val status: String,
    val createdAt: String,
    val customerName: String,
    val technicianName: String,
    val hasReview: Boolean,
    val history: List<String>,
)

data class StaffMember(
    val id: String,
    val email: String,
    val displayName: String,
    val role: String,
    val active: Boolean,
)

data class CustomerReview(
    val id: String,
    val orderId: String,
    val customerName: String,
    val rating: Int,
    val comment: String,
    val deviceType: String,
    val technicianName: String,
)

data class AuthResult(val accessToken: String, val user: AppUser)
data class NewStaffResult(val staff: StaffMember, val temporaryPassword: String)

class ApiException(val errorCode: String, override val message: String) : IOException(message)

object ApiClient {
    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')

    fun login(email: String, password: String, portal: String): AuthResult = authResult(
        request("POST", "/auth/login", body = JSONObject().put("email", email).put("password", password).put("portal", portal))
    )

    fun register(email: String, displayName: String, password: String): AuthResult = authResult(
        request("POST", "/auth/register", body = JSONObject().put("email", email).put("displayName", displayName).put("password", password))
    )

    fun me(token: String): AppUser = request("GET", "/auth/me", token).getJSONObject("user").toUser()
    fun logout(token: String) { request("POST", "/auth/logout", token) }

    fun changePassword(token: String, currentPassword: String, newPassword: String): AuthResult = authResult(
        request("POST", "/auth/change-password", token, JSONObject().put("currentPassword", currentPassword).put("newPassword", newPassword))
    )

    fun orders(token: String): List<RepairOrder> = request("GET", "/orders", token).getJSONArray("orders").mapObjects { it.toOrder() }

    fun createOrder(token: String, deviceType: String, problem: String, address: String): RepairOrder = request(
        "POST", "/orders", token,
        JSONObject().put("deviceType", deviceType).put("problem", problem).put("address", address)
    ).getJSONObject("order").toOrder()

    fun updateStatus(token: String, orderId: String, status: String, note: String = ""): RepairOrder = request(
        "PATCH", "/orders/$orderId/status", token,
        JSONObject().put("status", status).put("note", note)
    ).getJSONObject("order").toOrder()

    fun assignTechnician(token: String, orderId: String, technicianId: String): RepairOrder = request(
        "PATCH", "/orders/$orderId/assign", token,
        JSONObject().put("technicianId", technicianId)
    ).getJSONObject("order").toOrder()

    fun staff(token: String): List<StaffMember> = request("GET", "/staff", token).getJSONArray("staff").mapObjects { it.toStaff() }

    fun createStaff(token: String, email: String, displayName: String, role: String): NewStaffResult {
        val result = request("POST", "/staff", token,
            JSONObject().put("email", email).put("displayName", displayName).put("role", role))
        return NewStaffResult(result.getJSONObject("staff").toStaff(), result.getString("temporaryPassword"))
    }

    fun setStaffActive(token: String, staffId: String, active: Boolean): StaffMember = request(
        "PATCH", "/staff/$staffId/active", token, JSONObject().put("active", active)
    ).getJSONObject("staff").toStaff()

    fun reviews(token: String): List<CustomerReview> = request("GET", "/reviews", token)
        .getJSONArray("reviews").mapObjects { it.toReview() }

    fun createReview(token: String, orderId: String, rating: Int, comment: String): CustomerReview = request(
        "POST", "/reviews", token,
        JSONObject().put("orderId", orderId).put("rating", rating).put("comment", comment)
    ).getJSONObject("review").toReview()

    private fun authResult(json: JSONObject) = AuthResult(json.getString("accessToken"), json.getJSONObject("user").toUser())

    private fun request(method: String, path: String, token: String? = null, body: JSONObject? = null): JSONObject {
        if (baseUrl.isBlank()) throw ApiException("API_NOT_CONFIGURED", "Адрес сервера ещё не настроен для этой сборки.")
        if (!baseUrl.startsWith("https://")) throw ApiException("HTTPS_REQUIRED", "Сервер должен использовать защищённое HTTPS-подключение.")
        val connection = URL("$baseUrl/api$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val statusCode = connection.responseCode
            if (statusCode == HttpURLConnection.HTTP_NO_CONTENT) return JSONObject()
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(responseText) }.getOrElse { JSONObject() }
            if (statusCode !in 200..299) {
                val error = json.optJSONObject("error")
                throw ApiException(error?.optString("code").orEmpty(), error?.optString("message").takeUnless { it.isNullOrBlank() } ?: "Не удалось выполнить запрос.")
            }
            return json
        } finally {
            connection.disconnect()
        }
    }

    private fun JSONObject.toUser() = AppUser(
        id = getString("id"), email = getString("email"), displayName = getString("displayName"),
        role = getString("role"), mustChangePassword = optBoolean("mustChangePassword")
    )

    private fun JSONObject.toOrder(): RepairOrder {
        val technician = optJSONObject("assignedTechnician")
        val customer = optJSONObject("customer")
        val statusEvents = optJSONArray("statusEvents") ?: JSONArray()
        val existingReview = optJSONObject("review")
        return RepairOrder(
            id = getString("id"), deviceType = getString("deviceType"), problem = getString("problem"),
            address = getString("address"), status = getString("status"), createdAt = optString("createdAt"),
            customerName = customer?.optString("displayName").orEmpty(),
            technicianName = technician?.optString("displayName").orEmpty(),
            hasReview = existingReview != null && existingReview.length() > 0,
            history = statusEvents.mapObjects { event ->
                val from = event.optString("from").takeUnless { it == "null" || it.isBlank() }
                val to = event.optString("to")
                val note = event.optString("note").takeUnless { it == "null" || it.isBlank() }
                val actor = event.optJSONObject("actor")?.optString("displayName").orEmpty()
                listOfNotNull(from?.let { "${it.statusLabel()} → ${to.statusLabel()}" }, to.statusLabel().takeIf { from == null }, note, actor.takeIf { it.isNotBlank() }).joinToString(" · ")
            }
        )
    }

    private fun JSONObject.toStaff() = StaffMember(
        id = getString("id"), email = getString("email"), displayName = getString("displayName"),
        role = getString("role"), active = optBoolean("active", true)
    )

    private fun JSONObject.toReview(): CustomerReview {
        val order = optJSONObject("order") ?: JSONObject()
        val technician = order.optJSONObject("assignedTechnician")
        val customer = optJSONObject("customer")
        return CustomerReview(
            id = getString("id"), orderId = getString("orderId"), customerName = customer?.optString("displayName").orEmpty(),
            rating = getInt("rating"), comment = getString("comment"), deviceType = order.optString("deviceType"),
            technicianName = technician?.optString("displayName").orEmpty()
        )
    }

    private inline fun <T> JSONArray.mapObjects(transform: (JSONObject) -> T): List<T> =
        (0 until length()).mapNotNull { index -> optJSONObject(index)?.let(transform) }
}

fun String.deviceLabel(): String = when (this) {
    "COMPUTER" -> "Компьютер"
    "LAPTOP" -> "Ноутбук"
    "PHONE" -> "Телефон"
    "TABLET" -> "Планшет"
    else -> this
}

fun String.statusLabel(): String = when (this) {
    "REQUESTED" -> "Новая"
    "ASSIGNED" -> "Назначен мастер"
    "IN_PROGRESS" -> "В ремонте"
    "COMPLETED" -> "Завершена"
    "CANCELLED" -> "Отменена"
    else -> this
}

fun String.roleLabel(): String = when (this) {
    "CUSTOMER" -> "Клиент"
    "TECHNICIAN" -> "Мастер"
    "ADMIN" -> "Администратор"
    else -> this
}
