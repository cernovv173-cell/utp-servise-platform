package ru.utp.servise.data

import org.json.JSONObject
import ru.utp.servise.BuildConfig
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(val errorCode: String, override val message: String) : IOException(message)

object ApiClient {
    internal val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')

    fun login(email: String, password: String, portal: String): AuthResult = authResult(
        request("POST", "/auth/login", body = JSONObject().put("email", email).put("password", password).put("portal", portal))
    )

    fun requestPasswordReset(email: String) {
        request("POST", "/auth/password-reset/request", body = JSONObject().put("email", email))
    }

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

    fun orders(token: String, archived: Boolean? = null): List<RepairOrder> {
        val path = when (archived) {
            true -> "/orders?archive=archived"
            false -> "/orders?archive=active"
            null -> "/orders"
        }
        return request("GET", path, token).getJSONArray("orders").mapObjects { it.toOrder() }
    }

    fun searchOrders(token: String, serviceNumber: String): List<RepairOrder> {
        val query = URLEncoder.encode(serviceNumber.trim(), Charsets.UTF_8.name())
        return request("GET", "/orders/search?serviceNumber=$query", token)
            .getJSONArray("orders").mapObjects { it.toOrder() }
    }

    fun catalog(token: String): List<CatalogItem> = request("GET", "/catalog", token)
        .getJSONArray("catalogItems").mapObjects { it.toCatalogItem() }

    fun createCatalogItem(
        token: String,
        type: String,
        name: String,
        unitPriceRub: Int,
        stockQuantity: Int? = null,
    ): CatalogItem {
        val body = JSONObject().put("type", type).put("name", name).put("unitPriceRub", unitPriceRub)
        if (type == "SPARE_PART") body.put("stockQuantity", stockQuantity ?: 0)
        return request("POST", "/catalog", token, body).getJSONObject("catalogItem").toCatalogItem()
    }

    fun updateCatalogItem(token: String, item: CatalogItem): CatalogItem = request(
        "PATCH", "/catalog/${item.id}", token,
        JSONObject()
            .put("type", item.type)
            .put("name", item.name)
            .put("unitPriceRub", item.unitPriceRub)
            .put("active", item.active)
            .apply {
                if (item.type == "SPARE_PART" && item.stockQuantity != null) {
                    put("stockQuantity", item.stockQuantity)
                }
            },
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

    fun banners(token: String): List<SiteBanner> = request("GET", "/banners", token)
        .getJSONArray("banners").mapObjects { banner ->
            SiteBanner(
                id = banner.getString("id"),
                title = banner.getString("title"),
                content = banner.optString("content"),
                imageObjectId = banner.nullableString("imageObjectId"),
                targetUrl = banner.nullableString("targetUrl"),
                placements = banner.optJSONArray("placements").strings(),
                startsAt = banner.nullableString("startsAt"),
                endsAt = banner.nullableString("endsAt"),
                isActive = banner.optBoolean("isActive"),
            )
        }

    fun loyalty(token: String): LoyaltyAccount {
        val json = request("GET", "/loyalty/me", token)
        return LoyaltyAccount(
            balance = json.optInt("balance"),
            transactions = json.optJSONArray("transactions").mapObjects { transaction ->
                LoyaltyTransaction(
                    id = transaction.getString("id"),
                    type = transaction.optString("type"),
                    points = transaction.optInt("points"),
                    reason = transaction.optString("reason"),
                    createdAt = transaction.optString("createdAt"),
                    serviceNumber = transaction.optJSONObject("order")?.nullableString("serviceNumber"),
                )
            },
        )
    }

    fun salary(token: String): SalarySummary {
        val timeZone = URLEncoder.encode(java.time.ZoneId.systemDefault().id, Charsets.UTF_8.name())
        return request("GET", "/salary?timeZone=$timeZone", token).toSalarySummary()
    }

    fun companyInfo(): CompanyInfo = request("GET", "/about")
        .getJSONObject("company")
        .toCompanyInfo()

    fun updateCompanyInfo(token: String, company: CompanyInfo): CompanyInfo = request(
        "PUT", "/about", token, company.toRequestJson(),
    ).getJSONObject("company").toCompanyInfo()

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

    fun supportChat(token: String): SupportChat = request(
        "GET", "/support/chat", token,
    ).getJSONObject("chat").toSupportChat()

    fun sendSupportChatMessage(token: String, content: String): SupportChat = request(
        "POST", "/support/chat/messages", token,
        JSONObject().put("content", content),
    ).getJSONObject("chat").toSupportChat()

    fun administratorSupportChats(token: String): List<SupportChatInboxItem> = request(
        "GET", "/admin/support/chats", token,
    ).getJSONArray("chats").mapObjects { it.toSupportChatInboxItem() }

    fun administratorSupportChat(token: String, customerId: String): SupportChat = request(
        "GET", "/admin/support/chats/$customerId", token,
    ).getJSONObject("chat").toSupportChat()

    fun sendAdministratorSupportMessage(
        token: String,
        customerId: String,
        content: String,
    ): SupportChat = request(
        "POST", "/admin/support/chats/$customerId/messages", token,
        JSONObject().put("content", content),
    ).getJSONObject("chat").toSupportChat()

    fun administratorCustomers(
        token: String,
        search: String,
        page: Int,
        pageSize: Int = 20,
    ): AdminCustomerPage {
        val query = URLEncoder.encode(search.trim(), Charsets.UTF_8.name())
        val response = request(
            "GET", "/admin/customers?search=$query&page=$page&pageSize=$pageSize", token,
        )
        val pagination = response.getJSONObject("pagination")
        return AdminCustomerPage(
            customers = response.getJSONArray("customers").mapObjects { it.toAdminCustomer() },
            page = pagination.optInt("page", page),
            totalPages = pagination.optInt("totalPages"),
            totalItems = pagination.optInt("totalItems"),
        )
    }

    fun updateAdministratorCustomer(token: String, customer: AdminCustomer): AdminCustomer = request(
        "PATCH", "/admin/customers/${customer.id}", token,
        JSONObject()
            .put("email", customer.email)
            .put("displayName", customer.displayName)
            .put("phoneNumber", customer.phoneNumber ?: JSONObject.NULL),
    ).getJSONObject("customer").toAdminCustomer()

    fun createOrder(token: String, deviceType: String, problem: String, address: OrderAddress): RepairOrder = request(
        "POST", "/orders", token,
        JSONObject().put("deviceType", deviceType).put("problem", problem).putAddress(address),
    ).getJSONObject("order").toOrder()

    fun updateOrder(token: String, orderId: String, deviceType: String, problem: String, address: OrderAddress): RepairOrder = request(
        "PATCH", "/orders/$orderId", token,
        JSONObject().put("deviceType", deviceType).put("problem", problem).putAddress(address),
    ).getJSONObject("order").toOrder()

    fun requestBonusRedemption(token: String, orderId: String, redeem: Boolean): RepairOrder = request(
        "PATCH", "/orders/$orderId/bonus-redemption", token,
        JSONObject().put("redeemBonuses", redeem),
    ).getJSONObject("order").toOrder()

    fun createReceipt(
        token: String,
        orderId: String,
        itemQuantities: List<ReceiptDraftItemQuantity>,
        freeSaleItem: FreeSaleReceiptDraftItem?,
    ): RepairReceipt {
        val quantitiesJson = org.json.JSONArray().apply {
            itemQuantities.forEach { item ->
                put(JSONObject().put("itemId", item.itemId).put("quantity", item.quantity))
            }
        }
        val freeSaleJson = org.json.JSONArray().apply {
            freeSaleItem?.let { item ->
                put(
                    JSONObject()
                        .put("type", item.type)
                        .put("name", item.name)
                        .put("quantity", item.quantity)
                        .put("unitPriceRub", item.unitPriceRub),
                )
            }
        }
        return request(
            "POST",
            "/orders/$orderId/receipt",
            token,
            JSONObject()
                .put("itemQuantities", quantitiesJson)
                .put("freeSaleItems", freeSaleJson),
        ).getJSONObject("receipt").toRepairReceipt()
    }

    fun markReceiptPaid(token: String, orderId: String, method: String): RepairReceipt = request(
        "PATCH", "/orders/$orderId/receipt/payment", token,
        JSONObject().put("paymentMethod", method),
    ).getJSONObject("receipt").toRepairReceipt()

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

    fun deleteTechnician(token: String, staffId: String): StaffMember = request(
        "DELETE", "/staff/$staffId", token,
    ).getJSONObject("staff").toStaff()

    fun updateStaff(token: String, staff: StaffMember): StaffMember = request(
        "PATCH", "/staff/${staff.id}", token,
        JSONObject().put("displayName", staff.displayName).put("phoneNumber", staff.phoneNumber ?: JSONObject.NULL),
    ).getJSONObject("staff").toStaff()

    fun reviews(token: String): List<CustomerReview> = request("GET", "/reviews", token)
        .getJSONArray("reviews").mapObjects { it.toReview() }

    fun createReview(token: String, orderId: String, rating: Int, comment: String, image: ByteArray? = null): CustomerReview {
        val review = request(
        "POST", "/reviews", token,
        JSONObject().put("orderId", orderId).put("rating", rating).put("comment", comment)
        ).getJSONObject("review").toReview()
        if (image != null) MediaApiClient.binaryRequest("POST", "/reviews/${review.id}/image", token, image)
        return review
    }

    fun moderateReview(token: String, reviewId: String, isPublished: Boolean): CustomerReview = request(
        "PATCH", "/reviews/$reviewId", token,
        JSONObject().put("isPublished", isPublished),
    ).getJSONObject("review").toReview()

    private fun JSONObject.putAddress(address: OrderAddress): JSONObject = put("contactPhone", address.contactPhone)
        .put("city", address.city)
        .put("street", address.street)
        .put("house", address.house)
        .put("apartment", address.apartment)
        .put("entrance", address.entrance)
        .put("hasBarrier", address.hasBarrier)
        .put("floor", address.floor)
        .put("additionalPhone", address.additionalPhone)
        .put("additionalInfo", address.additionalInfo)

    private fun authResult(json: JSONObject) = AuthResult(json.getString("accessToken"), json.getJSONObject("user").toUser())

    internal fun request(method: String, path: String, token: String? = null, body: JSONObject? = null): JSONObject {
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


}
