package ru.utp.servise.data

import org.json.JSONObject
import org.json.JSONArray
import ru.utp.servise.BuildConfig
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiException(
    val errorCode: String,
    message: String,
    cause: Throwable? = null,
) : IOException(
    russianUserError(
        message,
        when (errorCode) {
            "AUTHENTICATION_REQUIRED", "INVALID_CREDENTIALS" -> "Не удалось войти. Проверьте данные и попробуйте ещё раз."
            "FORBIDDEN", "INSUFFICIENT_PERMISSIONS" -> "Недостаточно прав для этого действия."
            "NOT_FOUND" -> "Запрошенные данные не найдены. Обновите экран и попробуйте ещё раз."
            "NETWORK_ERROR", "TIMEOUT" -> "Не удалось подключиться к серверу. Проверьте интернет и повторите попытку."
            else -> "Не удалось выполнить запрос. Проверьте подключение и попробуйте ещё раз."
        },
    ),
    cause,
)

object ApiClient {
    internal val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')

    fun login(email: String, password: String, portal: String): AuthResult = authResult(
        request("POST", "/auth/login", body = JSONObject().put("email", email).put("password", password).put("portal", portal))
    )

    fun loginWithVk(
        accessToken: String,
        portal: String,
        password: String? = null,
        referralCode: String? = null,
    ): AuthResult {
        val body = JSONObject().put("accessToken", accessToken).put("portal", portal)
        password?.let { body.put("password", it) }
        referralCode?.trim()?.takeIf { it.isNotEmpty() }?.let { body.put("referralCode", it.uppercase()) }
        return authResult(request("POST", "/auth/vk", body = body))
    }

    fun maxLoginAvailable(): Boolean = request("GET", "/auth/max/config").optBoolean("available")

    fun startMaxLogin(referralCode: String? = null, expectedRole: String = "CUSTOMER"): MaxLoginStart {
        val body = JSONObject().put("expectedRole", expectedRole)
        referralCode?.trim()?.takeIf { it.isNotEmpty() }?.let { body.put("referralCode", it.uppercase()) }
        val json = request("POST", "/auth/max/login", body = body)
        return MaxLoginStart(
            url = json.getString("url"),
            pollToken = json.getString("pollToken"),
            expiresAt = json.getString("expiresAt"),
        )
    }

    fun pollMaxLogin(pollToken: String): MaxLoginPoll {
        val json = request("POST", "/auth/max/login/poll", body = JSONObject().put("pollToken", pollToken))
        return when (val status = json.optString("status")) {
            "completed" -> MaxLoginPoll.Completed(
                result = authResult(json),
                accountCreated = json.optBoolean("accountCreated"),
                referralApplied = json.optBoolean("referralApplied"),
            )
            "failed", "expired" -> MaxLoginPoll.Failed(
                message = russianUserError(
                    json.optString("message"),
                    "Не удалось войти через МАКС. Попробуйте ещё раз.",
                ),
                expired = status == "expired",
            )
            "awaiting_contact" -> MaxLoginPoll.Pending(awaitingContact = true)
            else -> MaxLoginPoll.Pending(awaitingContact = false)
        }
    }

    fun requestPasswordReset(identifier: String) {
        request("POST", "/auth/password-reset/request", body = JSONObject().put("identifier", identifier))
    }

    fun register(
        email: String,
        displayName: String,
        password: String,
        phoneNumber: String,
        referralCode: String? = null,
    ): AuthResult {
        val body = JSONObject()
            .put("email", email)
            .put("displayName", displayName)
            .put("phoneNumber", phoneNumber.trim())
            .put("password", password)
        referralCode?.trim()?.takeIf { it.isNotEmpty() }?.let { body.put("referralCode", it.uppercase()) }
        return authResult(request("POST", "/auth/register", body = body))
    }

    fun me(token: String): AppUser = request("GET", "/auth/me", token).getJSONObject("user").toUser()
    fun updateProfile(
        token: String,
        phoneNumber: String?,
        gender: String?,
        birthDate: String?,
    ): AppUser {
        val body = JSONObject()
            .put("phoneNumber", phoneNumber ?: JSONObject.NULL)
            .put("gender", gender ?: JSONObject.NULL)
            .put("birthDate", birthDate ?: JSONObject.NULL)
        return request("PATCH", "/auth/profile", token, body)
            .getJSONObject("user")
            .toUser()
    }

    fun updatePhoneNumber(token: String, phoneNumber: String): AppUser = request(
        "PATCH",
        "/auth/profile",
        token,
        JSONObject().put("phoneNumber", phoneNumber.trim()),
    ).getJSONObject("user").toUser()

    fun requestMaxEmailLoginCode(token: String, email: String) {
        request(
            "POST",
            "/auth/profile/email-login/request",
            token,
            JSONObject().put("email", email.trim()),
        )
    }

    fun confirmMaxEmailLogin(
        token: String,
        email: String,
        code: String,
        newPassword: String,
    ): AppUser = request(
        "POST",
        "/auth/profile/email-login/confirm",
        token,
        JSONObject()
            .put("email", email.trim())
            .put("code", code.trim())
            .put("newPassword", newPassword),
    ).getJSONObject("user").toUser()

    fun updateAvatar(token: String, image: ByteArray): AppUser = MediaApiClient
        .binaryRequest("POST", "/media/avatar", token, image)
        .getJSONObject("user")
        .toUser()
    fun deleteOwnAccount(token: String) { request("DELETE", "/customer/account", token) }
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

    fun updateCatalogInventory(
        token: String,
        catalogItemId: String,
        stockQuantity: Int,
        minimumStockQuantity: Int,
    ): CatalogItem = request(
        "PATCH",
        "/catalog/$catalogItemId/inventory",
        token,
        JSONObject()
            .put("stockQuantity", stockQuantity)
            .put("minimumStockQuantity", minimumStockQuantity),
    ).getJSONObject("catalogItem").toCatalogItem()

    fun shopProducts(): List<ShopProduct> = request("GET", "/shop/products")
        .getJSONArray("products").mapObjects { it.toShopProduct() }

    fun customerShopOrders(token: String): List<ShopOrder> = request("GET", "/shop/orders", token)
        .getJSONArray("orders").mapObjects { it.toShopOrder() }

    fun adminShopOrders(token: String): List<ShopOrder> = request("GET", "/admin/shop/orders", token)
        .getJSONArray("orders").mapObjects { it.toShopOrder() }

    fun createShopOrder(
        token: String,
        items: Map<String, Int>,
        customerNote: String,
        deliveryMethod: String = "PICKUP",
        deliveryArea: String? = null,
        deliveryCity: String? = null,
        deliveryAddress: String? = null,
        deliveryRequestNote: String? = null,
        craftItems: Map<String, Int> = emptyMap(),
    ): ShopOrder {
        require(deliveryMethod in setOf("PICKUP", "COURIER"))
        val bodyItems = JSONArray().apply {
            items.forEach { (catalogItemId, quantity) ->
                put(JSONObject().put("catalogItemId", catalogItemId).put("quantity", quantity))
            }
            craftItems.forEach { (craftItemId, quantity) ->
                put(JSONObject().put("craftItemId", craftItemId).put("quantity", quantity))
            }
        }
        val body = JSONObject()
            .put("items", bodyItems)
            .put("customerNote", customerNote.trim().take(1000))
        if (deliveryMethod == "COURIER") {
            require(deliveryArea in setOf("MOSCOW", "MOSCOW_REGION"))
            require(!deliveryCity.isNullOrBlank())
            require(!deliveryAddress.isNullOrBlank())
            body.put("deliveryMethod", deliveryMethod)
                .put("deliveryArea", deliveryArea)
                .put("deliveryCity", deliveryCity.trim().take(120))
                .put("deliveryAddress", deliveryAddress.trim().take(500))
            deliveryRequestNote?.trim()?.takeIf { it.isNotEmpty() }?.let {
                body.put("deliveryRequestNote", it.take(500))
            }
        }
        return request(
            "POST",
            "/shop/orders",
            token,
            body,
        ).getJSONObject("order").toShopOrder()
    }

    fun offerShopDelivery(
        token: String,
        orderId: String,
        deliveryFeeRub: Int,
        deliveryWindow: String,
    ): ShopOrder = request(
        "PATCH",
        "/admin/shop/orders/$orderId/delivery-offer",
        token,
        JSONObject()
            .put("deliveryFeeRub", deliveryFeeRub)
            .put("deliveryWindow", deliveryWindow.trim().take(160)),
    ).getJSONObject("order").toShopOrder()

    fun respondToShopDeliveryOffer(token: String, orderId: String, accept: Boolean): ShopOrder = request(
        "PATCH",
        "/shop/orders/$orderId/delivery-response",
        token,
        JSONObject().put("accept", accept),
    ).getJSONObject("order").toShopOrder()

    fun cancelPickupShopOrder(token: String, orderId: String): ShopOrder = request(
        "PATCH",
        "/shop/orders/$orderId/cancel",
        token,
    ).getJSONObject("order").toShopOrder()

    fun updateShopOrderStatus(token: String, orderId: String, status: String): ShopOrder {
        require(status in setOf("CONFIRMED", "COMPLETED", "CANCELLED"))
        return request(
            "PATCH",
            "/admin/shop/orders/$orderId/status",
            token,
            JSONObject().put("status", status),
        ).getJSONObject("order").toShopOrder()
    }

    fun customerServicePrices(token: String): List<CustomerServicePrice> = request(
        "GET",
        "/customer/service-prices",
        token,
    ).getJSONArray("prices").mapObjects { price ->
        CustomerServicePrice(
            id = price.getString("id"),
            name = price.getString("name"),
            unitPriceRub = price.getInt("unitPriceRub"),
            deviceTypes = price.optJSONArray("deviceTypes")?.let { values ->
                List(values.length()) { index -> values.getString(index) }
            } ?: listOf("COMPUTER", "LAPTOP"),
        )
    }

    fun operationsDashboard(token: String): OperationsDashboard = request(
        "GET", "/admin/operations/dashboard", token,
    ).toOperationsDashboard()

    fun procurementList(token: String): List<ProcurementItem> = request(
        "GET", "/admin/operations/procurement", token,
    ).getJSONArray("items").mapObjects { it.toProcurementItem() }

    fun repairSchedule(token: String, from: String, to: String): List<ScheduledRepairOrder> {
        val encodedFrom = URLEncoder.encode(from, Charsets.UTF_8.name())
        val encodedTo = URLEncoder.encode(to, Charsets.UTF_8.name())
        return request(
            "GET", "/admin/operations/calendar?from=$encodedFrom&to=$encodedTo", token,
        ).getJSONArray("orders").mapObjects { it.toScheduledRepairOrder() }
    }

    fun updateRepairPriority(token: String, orderId: String, priority: String) {
        require(priority in setOf("NORMAL", "URGENT"))
        request("PATCH", "/admin/operations/orders/$orderId/priority", token, JSONObject().put("priority", priority))
    }

    fun createCatalogItem(
        token: String,
        type: String,
        name: String,
        unitPriceRub: Int,
        stockQuantity: Int? = null,
        minimumStockQuantity: Int? = null,
        description: String? = null,
        deviceTypes: List<String> = listOf("COMPUTER", "LAPTOP"),
    ): CatalogItem {
        val body = JSONObject()
            .put("type", type)
            .put("name", name)
            .put("unitPriceRub", unitPriceRub)
            .put("deviceTypes", JSONArray().apply { deviceTypes.forEach(::put) })
        if (type == "PRODUCT") body.put("description", description ?: JSONObject.NULL)
        if (type != "SERVICE") {
            body.put("stockQuantity", stockQuantity ?: 0)
            body.put("minimumStockQuantity", minimumStockQuantity ?: 3)
        }
        return request("POST", "/catalog", token, body).getJSONObject("catalogItem").toCatalogItem()
    }

    fun updateCatalogItem(token: String, item: CatalogItem): CatalogItem = request(
        "PATCH", "/catalog/${item.id}", token,
        JSONObject()
            .put("type", item.type)
            .put("name", item.name)
            .put("unitPriceRub", item.unitPriceRub)
            .put("active", item.active)
            .put("deviceTypes", JSONArray().apply { item.deviceTypes.forEach(::put) })
            .apply {
                if (item.type == "PRODUCT") {
                    put("description", item.description ?: JSONObject.NULL)
                }
                if (item.type != "SERVICE" && item.stockQuantity != null) {
                    put("stockQuantity", item.stockQuantity)
                }
                if (item.type != "SERVICE" && item.minimumStockQuantity != null) {
                    put("minimumStockQuantity", item.minimumStockQuantity)
                }
            },
    ).getJSONObject("catalogItem").toCatalogItem()

    fun deleteCatalogItem(token: String, catalogItemId: String) {
        request("DELETE", "/catalog/$catalogItemId", token)
    }

    fun uploadCatalogProductImage(token: String, catalogItemId: String, image: ByteArray) {
        MediaApiClient.binaryRequest(
            "POST",
            "/catalog/$catalogItemId/images",
            token,
            image,
        )
    }

    fun deleteCatalogProductImage(
        token: String,
        catalogItemId: String,
        objectId: String,
    ): CatalogItem = request(
        "DELETE",
        "/catalog/$catalogItemId/images/${android.net.Uri.encode(objectId)}",
        token,
    ).getJSONObject("catalogItem").toCatalogItem()

    fun craftItems(token: String): List<CraftItem> = request("GET", "/craft-items", token)
        .getJSONArray("items").mapObjects { it.toCraftItem() }

    fun createCraftItem(token: String, title: String, description: String, priceRub: Int, isPublished: Boolean, customOrderAvailable: Boolean, stockQuantity: Int = 0): CraftItem = request(
        "POST", "/craft-items", token,
        JSONObject().put("title", title).put("description", description).put("priceRub", priceRub)
            .put("isPublished", isPublished).put("customOrderAvailable", customOrderAvailable)
            .put("stockQuantity", stockQuantity.coerceIn(0, 100_000)),
    ).getJSONObject("item").toCraftItem()

    fun updateCraftItem(
        token: String,
        itemId: String,
        title: String? = null,
        description: String? = null,
        priceRub: Int? = null,
        isPublished: Boolean? = null,
        stockQuantity: Int? = null,
        customOrderAvailable: Boolean? = null,
    ): CraftItem {
        val body = JSONObject()
        title?.let { body.put("title", it) }
        description?.let { body.put("description", it) }
        priceRub?.let { body.put("priceRub", it) }
        isPublished?.let { body.put("isPublished", it) }
        stockQuantity?.let { body.put("stockQuantity", it.coerceIn(0, 100_000)) }
        customOrderAvailable?.let { body.put("customOrderAvailable", it) }
        return request("PATCH", "/craft-items/$itemId", token, body).getJSONObject("item").toCraftItem()
    }

    fun deleteCraftItem(token: String, itemId: String) {
        request("DELETE", "/craft-items/$itemId", token)
    }

    fun uploadCraftItemImage(token: String, itemId: String, image: ByteArray) {
        MediaApiClient.binaryRequest("POST", "/craft-items/$itemId/images", token, image)
    }

    fun deleteCraftItemImage(token: String, itemId: String, objectId: String): CraftItem = request(
        "DELETE",
        "/craft-items/$itemId/images/${android.net.Uri.encode(objectId)}",
        token,
    ).getJSONObject("item").toCraftItem()

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

    fun saveCraftOrderTerms(
        token: String,
        orderId: String,
        quotedPriceRub: Int,
        assignedTechnicianId: String?,
        status: String? = null,
    ): CraftOrder {
        val body = JSONObject()
            .put("quotedPriceRub", quotedPriceRub)
            .put("assignedTechnicianId", assignedTechnicianId ?: JSONObject.NULL)
        status?.let { body.put("status", it) }
        return request("PATCH", "/craft-orders/$orderId", token, body)
            .getJSONObject("order").toCraftOrder()
    }

    fun markCraftReceiptPaid(token: String, orderId: String, paymentMethod: String): CraftOrderReceipt = request(
        "PATCH", "/craft-orders/$orderId/receipt/payment", token,
        JSONObject().put("paymentMethod", paymentMethod),
    ).getJSONObject("receipt").toCraftOrderReceipt()

    fun craftOrderChat(token: String, orderId: String): CraftOrderChat = request(
        "GET", "/craft-orders/$orderId/chat", token,
    ).toCraftOrderChat()

    fun sendCraftOrderChatMessage(token: String, orderId: String, content: String): CraftOrderChat = request(
        "POST", "/craft-orders/$orderId/chat/messages", token,
        JSONObject().put("content", content),
    ).toCraftOrderChat()

    fun uploadCraftOrderChatImage(token: String, orderId: String, image: ByteArray) {
        MediaApiClient.binaryRequest("POST", "/craft-orders/$orderId/chat/image", token, image)
    }

    fun news(token: String, previousFactId: String? = null): NewsFeed {
        val query = previousFactId
            ?.takeIf(String::isNotBlank)
            ?.let { "?previousFactId=${URLEncoder.encode(it, Charsets.UTF_8.name())}" }
            .orEmpty()
        val response = request("GET", "/news$query", token)
        val now = java.time.Instant.now()
        val birthdayGreeting = response.optJSONObject("birthdayGreeting")?.let { greeting ->
            val startsAt = greeting.nullableString("startsAt")
            val endsAt = greeting.nullableString("endsAt")
            val isCurrentBirthday = runCatching {
                startsAt != null && endsAt != null &&
                    !now.isBefore(java.time.Instant.parse(startsAt)) &&
                    now.isBefore(java.time.Instant.parse(endsAt))
            }.getOrDefault(false)
            if (isCurrentBirthday) {
                NewsArticle(
                    id = "personal-birthday-${endsAt}",
                    title = greeting.getString("title"),
                    content = greeting.getString("content"),
                    isPublished = true,
                    publishedAt = startsAt,
                    imageObjectId = null,
                    startsAt = startsAt,
                    endsAt = endsAt,
                    isFeatured = false,
                )
            } else null
        }
        val technologyFact = response.optJSONObject("technologyFact")?.toTechnologyFact()
        val articles = listOfNotNull(birthdayGreeting) +
            response.getJSONArray("articles").mapObjects { it.toNewsArticle() }
        return NewsFeed(articles = articles, technologyFact = technologyFact)
    }

    fun publicTechnologyFact(previousFactId: String? = null): TechnologyFact {
        val query = previousFactId
            ?.takeIf(String::isNotBlank)
            ?.let { "?previousFactId=${URLEncoder.encode(it, Charsets.UTF_8.name())}" }
            .orEmpty()
        return request("GET", "/public/technology-fact$query")
            .getJSONObject("technologyFact")
            .toTechnologyFact()
    }

    fun publicReviews(): List<PublicReview> = request("GET", "/public/reviews")
        .getJSONArray("reviews")
        .mapObjects { review ->
            val customer = review.optJSONObject("customer")
            val order = review.optJSONObject("order")
            PublicReview(
                id = review.getString("id"),
                rating = review.getInt("rating"),
                comment = review.optString("comment"),
                createdAt = review.optString("createdAt"),
                customerName = customer?.optString("displayName")?.takeIf(String::isNotBlank) ?: "Клиент",
                deviceType = order?.optString("deviceType").orEmpty(),
            )
        }

    fun customerOffers(token: String): List<CustomerOffer> = request(
        "GET", "/offers", token,
    ).getJSONArray("offers").mapObjects { it.toCustomerOffer() }

    fun publicCustomerOffers(): List<PublicCustomerOffer> = request(
        "GET", "/public/offers",
    ).getJSONArray("offers").mapObjects { it.toPublicCustomerOffer() }

    fun participateInCustomerOffer(token: String, offerId: String, answerIndex: Int? = null) {
        val body = JSONObject().apply {
            answerIndex?.let { put("answerIndex", it) }
        }
        request("POST", "/offers/$offerId/participate", token, body)
    }

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

    fun referralProgram(token: String): ReferralProgram {
        val json = request("GET", "/referrals/me", token)
        val referralCode = json.optString("referralCode")
        val codes = json.optJSONArray("codes").mapObjects { code ->
            ReferralPromoCode(
                id = code.optString("id"),
                slot = code.optInt("slot", 1),
                code = code.optString("code"),
                issuedAt = code.optString("issuedAt"),
                expiresAt = code.optString("expiresAt"),
                status = code.optString("status", "AVAILABLE"),
            )
        }.ifEmpty {
            if (referralCode.isNotBlank()) {
                listOf(ReferralPromoCode(slot = 1, code = referralCode))
            } else {
                emptyList()
            }
        }
        return ReferralProgram(
            referralCode = referralCode,
            codes = codes,
            totalInvites = json.optInt("totalInvites"),
            pendingCount = json.optInt("pendingCount"),
            rewardedCount = json.optInt("rewardedCount"),
            referrals = json.optJSONArray("referrals").mapObjects { referral ->
                ReferralEntry(
                    id = referral.getString("id"),
                    status = referral.optString("status"),
                    createdAt = referral.optString("createdAt"),
                    rewardedAt = referral.nullableString("rewardedAt"),
                )
            },
        )
    }

    fun seasonalTheme(): SeasonalThemeState =
        request("GET", "/seasonal-theme").toSeasonalThemeState()

    fun setSeasonalTheme(token: String, season: String): SeasonalThemeState =
        request("PUT", "/seasonal-theme", token, JSONObject().put("season", season))
            .toSeasonalThemeState()

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
        kind: String = "NEWS",
    ): NewsArticle = request(
        "POST", "/news", token,
        JSONObject()
            .put("title", title)
            .put("content", content)
            .put("isPublished", isPublished)
            .put("startsAt", startsAt ?: JSONObject.NULL)
            .put("endsAt", endsAt ?: JSONObject.NULL)
            .put("isFeatured", isFeatured)
            .put("kind", kind),
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

    fun uploadNewsMedia(token: String, articleId: String, content: ByteArray, contentType: String) {
        MediaApiClient.binaryRequest("POST", "/news/$articleId/media", token, content, contentType)
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
            .put("displayName", customer.displayName)
            .put("phoneNumber", customer.phoneNumber ?: JSONObject.NULL)
            .apply { customer.email?.takeIf { it.isNotBlank() }?.let { put("email", it) } },
    ).getJSONObject("customer").toAdminCustomer()

    fun deleteAdministratorCustomer(token: String, customerId: String) {
        request("DELETE", "/admin/customers/$customerId", token)
    }

    fun createAdministratorCustomer(
        token: String,
        displayName: String,
        email: String,
        phoneNumber: String,
    ): NewAdminCustomerResult {
        val response = request(
            "POST", "/admin/customers", token,
            JSONObject().put("displayName", displayName).apply {
                email.trim().takeIf { it.isNotEmpty() }?.let { put("email", it) }
                if (phoneNumber.isNotBlank()) put("phoneNumber", phoneNumber)
            },
        )
        val credentialDelivery = response.optJSONObject("credentialDelivery")
        return NewAdminCustomerResult(
            customer = response.getJSONObject("customer").toAdminCustomer(),
            temporaryPassword = response.nullableString("temporaryPassword"),
            credentialDeliveryPending = credentialDelivery?.optString("status") == "PENDING",
        )
    }

    fun startAdministratorCustomerMaxActivation(
        token: String,
        customerId: String,
    ): MaxActivationLink {
        val response = request(
            "POST",
            "/admin/customers/$customerId/max-activation",
            token,
        )
        return MaxActivationLink(
            url = response.getString("url"),
            expiresAt = response.getString("expiresAt"),
        )
    }

    fun createOrder(
        token: String,
        deviceType: String,
        problem: String,
        address: OrderAddress,
        details: RepairRequestDetails = RepairRequestDetails(),
    ): RepairOrder {
        val body = JSONObject()
            .put("deviceType", deviceType)
            .put("problem", problem)
            .put("useNewRepairScenario", details.useNewRepairScenario)
            .putAddress(address)
        details.deviceBrand.trim().takeIf { it.isNotEmpty() }?.let { body.put("deviceBrand", it) }
        details.deviceModel.trim().takeIf { it.isNotEmpty() }?.let { body.put("deviceModel", it) }
        details.deviceSerialNumber.trim().takeIf { it.isNotEmpty() }?.let { body.put("deviceSerialNumber", it) }
        details.preferredAt?.let { body.put("preferredAt", it) }
        details.customerDeviceId?.let { body.put("customerDeviceId", it) }
        body.put("repairLocation", details.repairLocation)
        details.visitIsWithinCity?.let { body.put("visitIsWithinCity", it) }
        details.visitCustomerDistanceKm?.let { body.put("visitCustomerDistanceKm", it) }
        return request("POST", "/orders", token, body).getJSONObject("order").toOrder()
    }

    fun customerDevices(token: String): List<CustomerDevice> =
        request("GET", "/customer/devices", token)
            .getJSONArray("devices")
            .mapObjects { it.toCustomerDevice() }

    fun createWarrantyClaim(token: String, originalOrderId: String, problem: String): RepairOrder =
        request(
            "POST",
            "/orders/$originalOrderId/warranty-claims",
            token,
            JSONObject().put("problem", problem.trim()),
        ).getJSONObject("order").toOrder()

    fun createCustomerDevice(
        token: String,
        deviceType: String,
        nickname: String,
        brand: String,
        model: String,
        serialNumber: String,
        nextMaintenanceAt: String?,
        maintenanceNote: String,
    ): CustomerDevice {
        val body = JSONObject()
            .put("deviceType", deviceType)
            .put("nickname", nickname.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
            .put("brand", brand.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
            .put("model", model.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
            .put("serialNumber", serialNumber.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
            .put("nextMaintenanceAt", nextMaintenanceAt ?: JSONObject.NULL)
            .put("maintenanceNote", maintenanceNote.takeIf { it.isNotBlank() } ?: JSONObject.NULL)
        return request("POST", "/customer/devices", token, body)
            .getJSONObject("device")
            .toCustomerDevice()
    }

    fun updateCustomerDeviceReminder(
        token: String,
        deviceId: String,
        nextMaintenanceAt: String?,
        maintenanceNote: String,
    ): CustomerDevice = request(
        "PATCH",
        "/customer/devices/$deviceId",
        token,
        JSONObject()
            .put("nextMaintenanceAt", nextMaintenanceAt ?: JSONObject.NULL)
            .put("maintenanceNote", maintenanceNote.takeIf { it.isNotBlank() } ?: JSONObject.NULL),
    ).getJSONObject("device").toCustomerDevice()

    fun deleteCustomerDevice(token: String, deviceId: String) {
        request("DELETE", "/customer/devices/$deviceId", token)
    }

    fun createAdministratorOrder(
        token: String,
        customerId: String,
        deviceType: String,
        problem: String,
        repairLocation: String,
        address: OrderAddress,
        useNewRepairScenario: Boolean = true,
        visitIsWithinCity: Boolean = true,
    visitCustomerDistanceKm: Int? = null,
): RepairOrder = request(
        "POST", "/admin/orders", token,
        JSONObject().put("customerId", customerId).put("deviceType", deviceType)
            .put("problem", problem).put("repairLocation", repairLocation).putAddress(address)
            .apply {
                put("useNewRepairScenario", useNewRepairScenario)
                if (repairLocation == "CUSTOMER_ADDRESS") {
                    put("visitIsWithinCity", visitIsWithinCity)
                    visitCustomerDistanceKm?.let { put("visitCustomerDistanceKm", it) }
                }
            },
    ).getJSONObject("order").toOrder()

    fun updateOrder(token: String, orderId: String, deviceType: String, problem: String, address: OrderAddress): RepairOrder = request(
        "PATCH", "/orders/$orderId", token,
        JSONObject().put("deviceType", deviceType).put("problem", problem).putAddress(address),
    ).getJSONObject("order").toOrder()

    fun updatePreferredVisitTime(token: String, orderId: String, preferredAt: String?): RepairOrder {
        val body = JSONObject().put("preferredAt", preferredAt ?: JSONObject.NULL)
        return request("PATCH", "/orders/$orderId", token, body)
            .getJSONObject("order").toOrder()
    }

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

    fun uploadIntakeMedia(
        token: String,
        orderId: String,
        content: ByteArray,
        contentType: String,
    ): RepairOrderIntake = MediaApiClient.binaryRequest(
        "POST", "/orders/$orderId/intake/media", token, content, contentType,
    ).getJSONObject("intake").toRepairOrderIntake()

    fun saveOrderIntake(
        token: String,
        orderId: String,
        conditionSummary: String,
        serialNumber: String,
        includedAccessories: String,
        intakeNotes: String,
    ): RepairOrderIntake = request(
        "PUT", "/orders/$orderId/intake", token,
        JSONObject().put("conditionSummary", conditionSummary)
            .put("serialNumber", serialNumber).put("includedAccessories", includedAccessories)
            .put("intakeNotes", intakeNotes),
    ).getJSONObject("intake").toRepairOrderIntake()

    fun repairOrderReleaseSummary(token: String, orderId: String): RepairOrderReleaseSummary = request(
        "GET", "/orders/$orderId/release-summary", token,
    ).toRepairOrderReleaseSummary()

    fun releaseRepairOrder(
        token: String,
        orderId: String,
        expectedAmountRub: Int,
        paymentMethod: String?,
        redeemBonuses: Boolean? = null,
    ): RepairOrder = request(
        "POST", "/orders/$orderId/release", token,
        JSONObject().put("expectedAmountRub", expectedAmountRub).apply {
            paymentMethod?.let { put("paymentMethod", it) }
            redeemBonuses?.let { put("redeemBonuses", it) }
        },
    ).getJSONObject("order").toOrder()

    fun downloadMedia(token: String, objectId: String): ByteArray =
        MediaApiClient.download(token, objectId)

    fun downloadPublicOfferPrizeImage(offerId: String, place: Int): ByteArray =
        MediaApiClient.downloadPublicOfferPrizeImage(offerId, place)

    fun updateStatus(token: String, orderId: String, status: String, note: String = ""): RepairOrder = request(
        "PATCH", "/orders/$orderId/status", token,
        JSONObject().put("status", status).put("note", note)
    ).getJSONObject("order").toOrder()

    fun setExpectedCompletion(
        token: String,
        orderId: String,
        expectedCompletionAt: String?,
        note: String,
    ): RepairOrder {
        val body = JSONObject().put("expectedCompletionAt", expectedCompletionAt ?: JSONObject.NULL)
        note.trim().takeIf { it.isNotEmpty() }?.let { body.put("note", it.take(500)) }
        return request("PATCH", "/orders/$orderId/expected-completion", token, body)
            .getJSONObject("order").toOrder()
    }

    fun completeRepairDiagnosis(token: String, orderId: String): RepairOrder = request(
        "POST", "/orders/$orderId/diagnosis-completed", token,
    ).getJSONObject("order").toOrder()

    fun verifyRepairVisitDistance(
        token: String,
        orderId: String,
        isWithinCity: Boolean,
        distanceKm: Int,
    ): RepairOrder = request(
        "PATCH", "/orders/$orderId/visit-distance", token,
        JSONObject().put("isWithinCity", isWithinCity).put("distanceKm", distanceKm),
    ).getJSONObject("order").toOrder()

    fun consentRepairVisitPickup(token: String, orderId: String): RepairOrder = request(
        "POST", "/orders/$orderId/visit-pickup", token,
        JSONObject().put("customerConsent", true),
    ).getJSONObject("order").toOrder()

    fun completeOnsiteRepair(
        token: String,
        orderId: String,
        repairAgreed: Boolean,
        repairPriceRub: Int,
        paymentMethod: String,
    ): RepairOrder = request(
        "POST", "/orders/$orderId/onsite-completion", token,
        JSONObject()
            .put("repairAgreed", repairAgreed)
            .put("repairPriceRub", repairPriceRub)
            .put("paymentMethod", paymentMethod),
    ).getJSONObject("order").toOrder()

    fun markTechnicianRepairCompleted(token: String, orderId: String): RepairOrder = request(
        "POST", "/orders/$orderId/technician-completed", token,
        JSONObject(),
    ).getJSONObject("order").toOrder()

    fun requestTelegramLink(token: String): String = request(
        "POST", "/auth/telegram/link", token,
    ).getString("url")

    fun isTelegramConnected(token: String): Boolean = request(
        "GET", "/auth/telegram/status", token,
    ).optBoolean("connected")

    fun disconnectTelegram(token: String) {
        request("DELETE", "/auth/telegram/link", token)
    }

    fun requestMaxLink(token: String): String = request(
        "POST", "/auth/max/link", token,
    ).getString("url")

    fun isMaxConnected(token: String): Boolean = request(
        "GET", "/auth/max/status", token,
    ).optBoolean("connected")

    fun disconnectMax(token: String) {
        request("DELETE", "/auth/max/link", token)
    }

    fun assignTechnician(token: String, orderId: String, technicianId: String): RepairOrder = request(
        "PATCH", "/orders/$orderId/assign", token,
        JSONObject().put("technicianId", technicianId)
    ).getJSONObject("order").toOrder()

    fun addOrderItem(token: String, orderId: String, catalogItemId: String, quantity: Int): RepairOrder = request(
        "POST", "/orders/$orderId/items", token,
        JSONObject().put("catalogItemId", catalogItemId).put("quantity", quantity),
    ).getJSONObject("order").toOrder()

    fun removeOrderItem(token: String, orderId: String, itemId: String): RepairOrder = request(
        "DELETE", "/orders/$orderId/items/$itemId", token,
    ).getJSONObject("order").toOrder()

    fun submitRepairEstimate(
        token: String,
        orderId: String,
        diagnosis: String,
        items: List<RepairEstimateDraftItem>,
    ): RepairEstimate {
        val itemsJson = JSONArray().apply {
            items.forEach { item ->
                put(JSONObject().put("catalogItemId", item.catalogItemId).put("quantity", item.quantity))
            }
        }
        return request(
            "POST",
            "/orders/$orderId/estimates",
            token,
            JSONObject().put("diagnosis", diagnosis).put("items", itemsJson),
        ).getJSONObject("estimate").toRepairEstimate()
    }

    fun reviewRepairEstimate(
        token: String,
        orderId: String,
        estimateId: String,
        decision: String,
        note: String?,
    ): RepairEstimate = request(
        "PATCH",
        "/orders/$orderId/estimates/$estimateId/review",
        token,
        JSONObject()
            .put("decision", decision)
            .put("note", note ?: JSONObject.NULL),
    ).getJSONObject("estimate").toRepairEstimate()

    fun saveRepairWorkAct(
        token: String,
        orderId: String,
        expectedRevision: Int,
        items: List<RepairWorkActDraftLine>,
    ): RepairWorkAct {
        val itemsJson = JSONArray().apply {
            items.forEach { item ->
                put(
                    JSONObject()
                        .put("lineId", item.lineId)
                        .put("orderItemId", item.orderItemId ?: JSONObject.NULL)
                        .put("catalogItemId", item.catalogItemId ?: JSONObject.NULL)
                        .put("quantity", item.quantity),
                )
            }
        }
        return request(
            "PUT",
            "/orders/$orderId/work-act",
            token,
            JSONObject().put("expectedRevision", expectedRevision).put("items", itemsJson),
        ).getJSONObject("workAct").toRepairWorkAct()
    }

    fun submitRepairWorkAct(token: String, orderId: String, expectedRevision: Int): RepairWorkAct =
        request(
            "PATCH",
            "/orders/$orderId/work-act/submit",
            token,
            JSONObject().put("expectedRevision", expectedRevision),
        ).getJSONObject("workAct").toRepairWorkAct()

    fun reviewRepairWorkAct(
        token: String,
        orderId: String,
        expectedRevision: Int,
        includedLineIds: List<String>,
    ): RepairWorkAct {
        val lineIds = JSONArray().apply { includedLineIds.forEach { put(it) } }
        return request(
            "PATCH",
            "/orders/$orderId/work-act/review",
            token,
            JSONObject().put("expectedRevision", expectedRevision).put("includedLineIds", lineIds),
        ).getJSONObject("workAct").toRepairWorkAct()
    }

    fun staff(token: String): List<StaffMember> = request("GET", "/staff", token).getJSONArray("staff").mapObjects { it.toStaff() }

    fun technicianProfile(token: String, userId: String): TechnicianProfile =
        request("GET", "/staff/$userId/profile", token).getJSONObject("profile").toTechnicianProfile()

    fun updateTechnicianIdentity(token: String, displayName: String, phoneNumber: String?) =
        request("PATCH", "/auth/profile", token, JSONObject()
            .put("displayName", displayName)
            .put("phoneNumber", phoneNumber ?: JSONObject.NULL))
            .getJSONObject("user")
            .toUser()

    fun saveTechnicianProfile(token: String, userId: String, displayName: String, phoneNumber: String?, experience: Int?, homeAddress: String): TechnicianProfile {
        request("PUT", "/staff/$userId/profile", token, JSONObject()
            .put("experienceYears", experience ?: JSONObject.NULL)
            .put("homeAddress", homeAddress)
            .put("bio", "")
            .put("certificates", JSONArray()))
        updateTechnicianIdentity(token, displayName, phoneNumber)
        return technicianProfile(token, userId)
    }

    fun setPortfolioConsent(token: String, orderId: String, photoId: String, consent: Boolean) = request(
        "PATCH", "/orders/$orderId/photos/$photoId/portfolio-consent", token,
        JSONObject().put("consent", consent),
    )

    fun createStaff(token: String, email: String, displayName: String, role: String, phoneNumber: String?): NewStaffResult {
        val result = request("POST", "/staff", token,
            JSONObject().put("email", email).put("displayName", displayName).put("role", role)
                .put("phoneNumber", phoneNumber ?: JSONObject.NULL))
        return NewStaffResult(result.getJSONObject("staff").toStaff(), result.getString("temporaryPassword"))
    }

    fun setStaffActive(token: String, staffId: String, active: Boolean): StaffMember = request(
        "PATCH", "/staff/$staffId/active", token, JSONObject().put("active", active)
    ).getJSONObject("staff").toStaff()

    fun terminateStaff(token: String, staffId: String): StaffMember = request(
        "POST", "/staff/$staffId/terminate", token,
    ).getJSONObject("staff").toStaff()

    fun updateStaff(token: String, staff: StaffMember): StaffMember = request(
        "PATCH", "/staff/${staff.id}", token,
        JSONObject()
            .put("displayName", staff.displayName)
            .put("phoneNumber", staff.phoneNumber ?: JSONObject.NULL)
            .put("salaryRatePercent", staff.salaryRatePercent),
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

    private fun JSONObject.toSeasonalThemeState() = SeasonalThemeState(
        activeSeason = optString("activeSeason", "NONE"),
        activatedAt = nullableString("activatedAt"),
        loaded = true,
    )

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
                throw ApiException(
                    error?.optString("code").orEmpty(),
                    error?.optString("message").takeUnless { it.isNullOrBlank() }
                        ?: "Не удалось выполнить запрос.",
                )
            }
            return json
        } catch (failure: ApiException) {
            throw failure
        } catch (failure: java.net.SocketTimeoutException) {
            throw ApiException("TIMEOUT", failure.message.orEmpty(), failure)
        } catch (failure: IOException) {
            throw ApiException("NETWORK_ERROR", failure.message.orEmpty(), failure)
        } finally {
            connection.disconnect()
        }
    }


}
