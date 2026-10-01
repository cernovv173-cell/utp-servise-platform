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
    val phoneNumber: String? = null,
    val avatarObjectId: String? = null,
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
    val customerPhoneNumber: String?,
    val customerAvatarObjectId: String?,
    val technicianName: String,
    val technicianPhoneNumber: String?,
    val technicianAvatarObjectId: String?,
    val hasReview: Boolean,
    val history: List<String>,
    val items: List<RepairOrderItem>,
    val photos: List<RepairOrderPhoto>,
    val serviceNumber: String = "",
    val expectedCompletionAt: String? = null,
    val bonusDiscountRub: Int = 0,
    val redeemBonuses: Boolean = false,
)

data class RepairOrderPhoto(val id: String, val objectId: String)

data class RepairOrderItem(
    val id: String,
    val type: String,
    val name: String,
    val quantity: Int,
    val unitPriceRub: Int,
    val addedByName: String,
)

data class CatalogItem(
    val id: String,
    val type: String,
    val name: String,
    val unitPriceRub: Int,
    val active: Boolean,
)

data class CraftItem(
    val id: String,
    val title: String,
    val description: String,
    val priceRub: Int,
    val imageObjectId: String?,
    val isPublished: Boolean,
    val customOrderAvailable: Boolean,
)

data class CraftOrder(
    val id: String,
    val itemTitle: String,
    val unitPriceRub: Int,
    val quotedPriceRub: Int?,
    val quantity: Int,
    val note: String,
    val isCustomOrder: Boolean,
    val status: String,
    val createdAt: String,
    val customerName: String,
    val customerPhone: String?,
)

data class NewsArticle(
    val id: String,
    val title: String,
    val content: String,
    val isPublished: Boolean,
    val publishedAt: String?,
    val imageObjectId: String?,
    val startsAt: String?,
    val endsAt: String?,
    val isFeatured: Boolean,
)

data class OrderChatMessage(
    val id: String,
    val senderName: String,
    val senderRole: String,
    val content: String,
    val createdAt: String,
)

data class OrderChat(
    val id: String?,
    val orderId: String,
    val adminRequestedAt: String?,
    val adminRequestedByName: String,
    val adminJoinedAt: String?,
    val adminJoinedByName: String,
    val messages: List<OrderChatMessage>,
)

data class AdminChatInboxItem(
    val orderId: String,
    val deviceType: String,
    val problem: String,
    val customerName: String,
    val technicianName: String,
    val lastMessage: String,
    val adminJoinedAt: String?,
)

data class StaffMember(
    val id: String,
    val email: String,
    val displayName: String,
    val phoneNumber: String?,
    val avatarObjectId: String?,
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
    internal val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')

    fun login(email: String, password: String, portal: String): AuthResult = authResult(
        request("POST", "/auth/login", body = JSONObject().put("email", email).put("password", password).put("portal", portal))
    )

    fun register(email: String, displayName: String, password: String, phoneNumber: String?): AuthResult = authResult(
        request("POST", "/auth/register", body = JSONObject()
            .put("email", email)
            .put("displayName", displayName)
            .put("phoneNumber", phoneNumber ?: JSONObject.NULL)
            .put("password", password))
    )

    fun me(token: String): AppUser = request("GET", "/auth/me", token).getJSONObject("user").toUser()
    fun updatePhoneNumber(token: String, phoneNumber: String?): AppUser = request(
        "PATCH", "/auth/profile", token,
        JSONObject().put("phoneNumber", phoneNumber ?: JSONObject.NULL),
    ).getJSONObject("user").toUser()
    fun updateAvatar(token: String, image: ByteArray): AppUser = MediaApiClient
        .binaryRequest("POST", "/media/avatar", token, image)
        .getJSONObject("user")
        .toUser()
    fun logout(token: String) { request("POST", "/auth/logout", token) }

    fun registerPushToken(sessionToken: String, pushToken: String) {
        request("PUT", "/auth/push-token", sessionToken, JSONObject().put("token", pushToken))
    }

    fun unregisterPushToken(sessionToken: String, pushToken: String) {
        request("DELETE", "/auth/push-token", sessionToken, JSONObject().put("token", pushToken))
    }

    fun changePassword(token: String, currentPassword: String, newPassword: String): AuthResult = authResult(
        request("POST", "/auth/change-password", token, JSONObject().put("currentPassword", currentPassword).put("newPassword", newPassword))
    )

    fun orders(token: String): List<RepairOrder> = request("GET", "/orders", token).getJSONArray("orders").mapObjects { it.toOrder() }

    fun catalog(token: String): List<CatalogItem> = request("GET", "/catalog", token)
        .getJSONArray("catalogItems").mapObjects { it.toCatalogItem() }

    fun createCatalogItem(token: String, type: String, name: String, unitPriceRub: Int): CatalogItem = request(
        "POST", "/catalog", token,
        JSONObject().put("type", type).put("name", name).put("unitPriceRub", unitPriceRub),
    ).getJSONObject("catalogItem").toCatalogItem()

    fun updateCatalogItem(token: String, item: CatalogItem): CatalogItem = request(
        "PATCH", "/catalog/${item.id}", token,
        JSONObject()
            .put("type", item.type)
            .put("name", item.name)
            .put("unitPriceRub", item.unitPriceRub)
            .put("active", item.active),
    ).getJSONObject("catalogItem").toCatalogItem()

    fun craftItems(token: String): List<CraftItem> = request("GET", "/craft-items", token)
        .getJSONArray("items").mapObjects { it.toCraftItem() }

    fun createCraftItem(token: String, title: String, description: String, priceRub: Int, isPublished: Boolean, customOrderAvailable: Boolean): CraftItem = request(
        "POST", "/craft-items", token,
        JSONObject().put("title", title).put("description", description).put("priceRub", priceRub)
            .put("isPublished", isPublished).put("customOrderAvailable", customOrderAvailable),
    ).getJSONObject("item").toCraftItem()

    fun updateCraftItem(token: String, itemId: String, priceRub: Int? = null, isPublished: Boolean? = null): CraftItem {
        val body = JSONObject()
        priceRub?.let { body.put("priceRub", it) }
        isPublished?.let { body.put("isPublished", it) }
        return request("PATCH", "/craft-items/$itemId", token, body).getJSONObject("item").toCraftItem()
    }

    fun uploadCraftImage(token: String, itemId: String, image: ByteArray) {
        MediaApiClient.binaryRequest("POST", "/craft-items/$itemId/image", token, image)
    }

    fun craftOrders(token: String): List<CraftOrder> = request("GET", "/craft-orders", token)
        .getJSONArray("orders").mapObjects { it.toCraftOrder() }

    fun createCraftOrder(token: String, itemId: String?, customTitle: String?, quantity: Int, note: String): CraftOrder {
        val body = JSONObject().put("quantity", quantity).put("note", note)
        if (itemId != null) body.put("itemId", itemId) else body.put("customTitle", customTitle.orEmpty())
        return request("POST", "/craft-orders", token, body).getJSONObject("order").toCraftOrder()
    }

    fun updateCraftOrderStatus(token: String, orderId: String, status: String): CraftOrder = request(
        "PATCH", "/craft-orders/$orderId", token, JSONObject().put("status", status),
    ).getJSONObject("order").toCraftOrder()

    fun news(token: String): List<NewsArticle> = request("GET", "/news", token)
        .getJSONArray("articles").mapObjects { it.toNewsArticle() }

    fun createNews(
        token: String,
        title: String,
        content: String,
        isPublished: Boolean,
        startsAt: String? = null,
        endsAt: String? = null,
        isFeatured: Boolean = false,
    ): NewsArticle = request(
        "POST", "/news", token,
        JSONObject()
            .put("title", title)
            .put("content", content)
            .put("isPublished", isPublished)
            .put("startsAt", startsAt ?: JSONObject.NULL)
            .put("endsAt", endsAt ?: JSONObject.NULL)
            .put("isFeatured", isFeatured),
    ).getJSONObject("article").toNewsArticle()

    fun updateNews(token: String, article: NewsArticle): NewsArticle = request(
        "PATCH", "/news/${article.id}", token,
        JSONObject()
            .put("title", article.title)
            .put("content", article.content)
            .put("isPublished", article.isPublished)
            .put("startsAt", article.startsAt ?: JSONObject.NULL)
            .put("endsAt", article.endsAt ?: JSONObject.NULL)
            .put("isFeatured", article.isFeatured),
    ).getJSONObject("article").toNewsArticle()

    fun uploadNewsImage(token: String, articleId: String, image: ByteArray) {
        MediaApiClient.binaryRequest("POST", "/news/$articleId/image", token, image)
    }

    fun orderChat(token: String, orderId: String): OrderChat = request(
        "GET", "/orders/$orderId/chat", token,
    ).getJSONObject("chat").toOrderChat()

    fun sendChatMessage(token: String, orderId: String, content: String): OrderChat = request(
        "POST", "/orders/$orderId/chat/messages", token,
        JSONObject().put("content", content),
    ).getJSONObject("chat").toOrderChat()

    fun requestAdministratorHelp(token: String, orderId: String): OrderChat = request(
        "POST", "/orders/$orderId/chat/request-admin", token,
    ).getJSONObject("chat").toOrderChat()

    fun joinOrderChatAsAdministrator(token: String, orderId: String): OrderChat = request(
        "POST", "/orders/$orderId/chat/join-admin", token,
    ).getJSONObject("chat").toOrderChat()

    fun administratorChatInbox(token: String): List<AdminChatInboxItem> = request(
        "GET", "/admin/chats", token,
    ).getJSONArray("chats").mapObjects { it.toAdminChatInboxItem() }

    fun createOrder(token: String, deviceType: String, problem: String, address: String): RepairOrder = request(
        "POST", "/orders", token,
        JSONObject().put("deviceType", deviceType).put("problem", problem).put("address", address)
    ).getJSONObject("order").toOrder()

    fun updateOrder(token: String, orderId: String, deviceType: String, problem: String, address: String): RepairOrder = request(
        "PATCH", "/orders/$orderId", token,
        JSONObject().put("deviceType", deviceType).put("problem", problem).put("address", address),
    ).getJSONObject("order").toOrder()

    fun uploadOrderPhoto(token: String, orderId: String, image: ByteArray) {
        MediaApiClient.binaryRequest("POST", "/orders/$orderId/photos", token, image)
    }

    fun downloadMedia(token: String, objectId: String): ByteArray =
        MediaApiClient.download(token, objectId)

    fun updateStatus(token: String, orderId: String, status: String, note: String = ""): RepairOrder = request(
        "PATCH", "/orders/$orderId/status", token,
        JSONObject().put("status", status).put("note", note)
    ).getJSONObject("order").toOrder()

    fun assignTechnician(token: String, orderId: String, technicianId: String): RepairOrder = request(
        "PATCH", "/orders/$orderId/assign", token,
        JSONObject().put("technicianId", technicianId)
    ).getJSONObject("order").toOrder()

    fun addOrderItem(token: String, orderId: String, catalogItemId: String, quantity: Int): RepairOrder = request(
        "POST", "/orders/$orderId/items", token,
        JSONObject().put("catalogItemId", catalogItemId).put("quantity", quantity),
    ).getJSONObject("order").toOrder()

    fun staff(token: String): List<StaffMember> = request("GET", "/staff", token).getJSONArray("staff").mapObjects { it.toStaff() }

    fun createStaff(token: String, email: String, displayName: String, role: String, phoneNumber: String?): NewStaffResult {
        val result = request("POST", "/staff", token,
            JSONObject().put("email", email).put("displayName", displayName).put("role", role)
                .put("phoneNumber", phoneNumber ?: JSONObject.NULL))
        return NewStaffResult(result.getJSONObject("staff").toStaff(), result.getString("temporaryPassword"))
    }

    fun setStaffActive(token: String, staffId: String, active: Boolean): StaffMember = request(
        "PATCH", "/staff/$staffId/active", token, JSONObject().put("active", active)
    ).getJSONObject("staff").toStaff()

    fun updateStaff(token: String, staff: StaffMember): StaffMember = request(
        "PATCH", "/staff/${staff.id}", token,
        JSONObject().put("displayName", staff.displayName).put("phoneNumber", staff.phoneNumber ?: JSONObject.NULL),
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
        phoneNumber = optString("phoneNumber").takeUnless { it.isBlank() || it == "null" },
        avatarObjectId = optString("avatarObjectId").takeUnless { it.isBlank() || it == "null" },
        role = getString("role"), mustChangePassword = optBoolean("mustChangePassword")
    )

    private fun JSONObject.toOrder(): RepairOrder {
        val technician = optJSONObject("assignedTechnician")
        val customer = optJSONObject("customer")
        val statusEvents = optJSONArray("statusEvents") ?: JSONArray()
        val items = optJSONArray("items") ?: JSONArray()
        val existingReview = optJSONObject("review")
        return RepairOrder(
            id = getString("id"), deviceType = getString("deviceType"), problem = getString("problem"),
            address = getString("address"), status = getString("status"), createdAt = optString("createdAt"),
            customerName = customer?.optString("displayName").orEmpty(),
            customerPhoneNumber = customer?.optString("phoneNumber")?.takeUnless { it.isBlank() || it == "null" },
            customerAvatarObjectId = customer?.optString("avatarObjectId")?.takeUnless { it.isBlank() || it == "null" },
            technicianName = technician?.optString("displayName").orEmpty(),
            technicianPhoneNumber = technician?.optString("phoneNumber")?.takeUnless { it.isBlank() || it == "null" },
            technicianAvatarObjectId = technician?.optString("avatarObjectId")?.takeUnless { it.isBlank() || it == "null" },
            hasReview = existingReview != null && existingReview.length() > 0,
            history = statusEvents.mapObjects { event ->
                val from = event.optString("from").takeUnless { it == "null" || it.isBlank() }
                val to = event.optString("to")
                val note = event.optString("note").takeUnless { it == "null" || it.isBlank() }
                val actor = event.optJSONObject("actor")?.optString("displayName").orEmpty()
                listOfNotNull(from?.let { "${it.statusLabel()} → ${to.statusLabel()}" }, to.statusLabel().takeIf { from == null }, note, actor.takeIf { it.isNotBlank() }).joinToString(" · ")
            },
            items = items.mapObjects { item ->
                RepairOrderItem(
                    id = item.getString("id"),
                    type = item.getString("type"),
                    name = item.getString("name"),
                    quantity = item.getInt("quantity"),
                    unitPriceRub = item.getInt("unitPriceRub"),
                    addedByName = item.optJSONObject("addedBy")?.optString("displayName").orEmpty(),
                )
            },
            photos = (optJSONArray("photos") ?: JSONArray()).mapObjects { photo ->
                RepairOrderPhoto(photo.getString("id"), photo.getString("objectId"))
            },
            serviceNumber = optString("serviceNumber").takeUnless { it.isBlank() || it == "null" } ?: getString("id"),
            expectedCompletionAt = optString("expectedCompletionAt").takeUnless { it.isBlank() || it == "null" },
            bonusDiscountRub = optInt("bonusDiscountRub", 0),
            redeemBonuses = optBoolean("redeemBonuses", false),
        )
    }

    private fun JSONObject.toStaff() = StaffMember(
        id = getString("id"), email = getString("email"), displayName = getString("displayName"),
        phoneNumber = optString("phoneNumber").takeUnless { it.isBlank() || it == "null" },
        avatarObjectId = optString("avatarObjectId").takeUnless { it.isBlank() || it == "null" },
        role = getString("role"), active = optBoolean("active", true)
    )

    private fun JSONObject.toCatalogItem() = CatalogItem(
        id = getString("id"),
        type = getString("type"),
        name = getString("name"),
        unitPriceRub = getInt("unitPriceRub"),
        active = optBoolean("active", true),
    )

    private fun JSONObject.toCraftItem() = CraftItem(
        id = getString("id"),
        title = getString("title"),
        description = optString("description"),
        priceRub = optInt("priceRub"),
        imageObjectId = optString("imageObjectId").takeUnless { it.isBlank() || it == "null" },
        isPublished = optBoolean("isPublished"),
        customOrderAvailable = optBoolean("customOrderAvailable", true),
    )

    private fun JSONObject.toCraftOrder(): CraftOrder {
        val customer = optJSONObject("customer")
        return CraftOrder(
            id = getString("id"),
            itemTitle = getString("itemTitleSnapshot"),
            unitPriceRub = optInt("unitPriceRubSnapshot"),
            quotedPriceRub = if (isNull("quotedPriceRub")) null else optInt("quotedPriceRub"),
            quantity = optInt("quantity", 1),
            note = optString("note"),
            isCustomOrder = optBoolean("isCustomOrder"),
            status = getString("status"),
            createdAt = optString("createdAt"),
            customerName = customer?.optString("displayName").orEmpty(),
            customerPhone = customer?.optString("phoneNumber")?.takeUnless { it.isBlank() || it == "null" },
        )
    }

    private fun JSONObject.toNewsArticle() = NewsArticle(
        id = getString("id"),
        title = getString("title"),
        content = getString("content"),
        isPublished = optBoolean("isPublished", false),
        publishedAt = optString("publishedAt").takeUnless { it == "null" || it.isBlank() },
        imageObjectId = optString("imageObjectId").takeUnless { it == "null" || it.isBlank() },
        startsAt = optString("startsAt").takeUnless { it == "null" || it.isBlank() },
        endsAt = optString("endsAt").takeUnless { it == "null" || it.isBlank() },
        isFeatured = optBoolean("isFeatured"),
    )

    private fun JSONObject.toOrderChat() = OrderChat(
        id = optString("id").takeUnless { it == "null" || it.isBlank() },
        orderId = getString("orderId"),
        adminRequestedAt = optString("adminRequestedAt").takeUnless { it == "null" || it.isBlank() },
        adminRequestedByName = optJSONObject("requestedBy")?.optString("displayName").orEmpty(),
        adminJoinedAt = optString("adminJoinedAt").takeUnless { it == "null" || it.isBlank() },
        adminJoinedByName = optJSONObject("joinedBy")?.optString("displayName").orEmpty(),
        messages = (optJSONArray("messages") ?: JSONArray()).mapObjects { message ->
            val sender = message.optJSONObject("sender")
            OrderChatMessage(
                id = message.getString("id"),
                senderName = sender?.optString("displayName").orEmpty().ifBlank { "Пользователь" },
                senderRole = sender?.optString("role").orEmpty(),
                content = message.getString("content"),
                createdAt = message.optString("createdAt"),
            )
        },
    )

    private fun JSONObject.toAdminChatInboxItem(): AdminChatInboxItem {
        val order = optJSONObject("order") ?: JSONObject()
        val lastMessage = optJSONArray("messages")?.optJSONObject(0)
        return AdminChatInboxItem(
            orderId = order.optString("id"),
            deviceType = order.optString("deviceType"),
            problem = order.optString("problem"),
            customerName = order.optJSONObject("customer")?.optString("displayName").orEmpty(),
            technicianName = order.optJSONObject("assignedTechnician")?.optString("displayName").orEmpty(),
            lastMessage = lastMessage?.optString("content").orEmpty(),
            adminJoinedAt = optString("adminJoinedAt").takeUnless { it == "null" || it.isBlank() },
        )
    }

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

fun String.orderItemTypeLabel(): String = when (this) {
    "SERVICE" -> "Услуга"
    "SPARE_PART" -> "Запчасть"
    else -> this
}

fun String.roleLabel(): String = when (this) {
    "CUSTOMER" -> "Клиент"
    "TECHNICIAN" -> "Мастер"
    "ADMIN" -> "Администратор"
    else -> this
}
