package ru.utp.servise.data

import org.json.JSONArray
import org.json.JSONObject

/** Admin-only campaign and loyalty requests, kept separate from the general client API. */
object AdminMarketingApi {
    fun offers(token: String): List<CustomerOffer> = ApiClient.request(
        "GET", "/admin/offers", token,
    ).getJSONArray("offers").toObjects { it.toCustomerOffer() }

    fun createOffer(
        token: String,
        type: String,
        title: String,
        content: String,
        prizes: List<Pair<String?, Int>>,
        startsAt: String,
        endsAt: String,
    ): CustomerOffer {
        require(prizes.size == 3) { "Для розыгрыша нужны призы для трёх мест." }
        val body = JSONObject()
            .put("type", type)
            .put("title", title.trim())
            .put("content", content.trim())
            .put("startsAt", startsAt)
            .put("endsAt", endsAt)
            .put("isPublished", false)
        prizes.forEachIndexed { index, (prize, points) ->
            val place = listOf("first", "second", "third")[index]
            body.put("${place}PlacePrize", prize?.trim()?.takeIf(String::isNotEmpty) ?: JSONObject.NULL)
            body.put("${place}PlacePoints", points)
        }
        return ApiClient.request("POST", "/admin/offers", token, body)
            .getJSONObject("offer").toCustomerOffer()
    }

    fun setOfferPublished(token: String, offerId: String, published: Boolean): CustomerOffer = ApiClient.request(
        "PATCH", "/admin/offers/$offerId", token,
        JSONObject().put("isPublished", published),
    ).getJSONObject("offer").toCustomerOffer()

    fun deleteOffer(token: String, offerId: String) {
        ApiClient.request("DELETE", "/admin/offers/$offerId", token)
    }

    fun drawOffer(token: String, offerId: String): CustomerOffer = ApiClient.request(
        "POST", "/admin/offers/$offerId/draw", token,
    ).getJSONObject("offer").toCustomerOffer()

    fun publishOfferResults(token: String, offerId: String): CustomerOffer = ApiClient.request(
        "POST", "/admin/offers/$offerId/publish-results", token,
    ).getJSONObject("offer").toCustomerOffer()

    fun banners(token: String): List<SiteBanner> = ApiClient.request(
        "GET", "/banners", token,
    ).getJSONArray("banners").toObjects { it.toSiteBanner() }

    fun createBanner(
        token: String,
        title: String,
        content: String,
        targetUrl: String?,
        placements: List<String>,
        startsAt: String?,
        endsAt: String?,
    ): SiteBanner {
        val body = JSONObject()
            .put("title", title.trim())
            .put("content", content.trim())
            .put("targetUrl", targetUrl?.trim()?.takeIf(String::isNotEmpty) ?: JSONObject.NULL)
            .put("placements", placements.toJsonArray())
            .put("startsAt", startsAt ?: JSONObject.NULL)
            .put("endsAt", endsAt ?: JSONObject.NULL)
            .put("isActive", false)
        return ApiClient.request("POST", "/banners", token, body)
            .getJSONObject("banner").toSiteBanner()
    }

    fun updateBanner(
        token: String,
        bannerId: String,
        title: String,
        content: String,
        targetUrl: String?,
        placements: List<String>,
        startsAt: String?,
        endsAt: String?,
    ): SiteBanner {
        val body = JSONObject()
            .put("title", title.trim())
            .put("content", content.trim())
            .put("targetUrl", targetUrl?.trim()?.takeIf(String::isNotEmpty) ?: JSONObject.NULL)
            .put("placements", placements.toJsonArray())
            .put("startsAt", startsAt ?: JSONObject.NULL)
            .put("endsAt", endsAt ?: JSONObject.NULL)
        return ApiClient.request("PATCH", "/banners/$bannerId", token, body)
            .getJSONObject("banner").toSiteBanner()
    }

    fun setBannerActive(token: String, bannerId: String, isActive: Boolean): SiteBanner = ApiClient.request(
        "PATCH", "/banners/$bannerId", token,
        JSONObject().put("isActive", isActive),
    ).getJSONObject("banner").toSiteBanner()

    fun deleteBanner(token: String, bannerId: String) {
        ApiClient.request("DELETE", "/banners/$bannerId", token)
    }

    fun uploadBannerImage(token: String, bannerId: String, image: ByteArray) {
        MediaApiClient.binaryRequest("POST", "/banners/$bannerId/image", token, image)
    }

    fun loyaltyCustomers(token: String): List<AdminLoyaltyCustomer> = ApiClient.request(
        "GET", "/admin/loyalty", token,
    ).getJSONArray("customers").toObjects { item ->
        val customer = item.getJSONObject("customer")
        AdminLoyaltyCustomer(
            id = customer.getString("id"),
            displayName = customer.optString("displayName", "Клиент"),
            email = customer.nullableString("email"),
            balance = item.optInt("balance"),
            transactions = (item.optJSONArray("transactions") ?: JSONArray()).toObjects { transaction ->
                LoyaltyTransaction(
                    id = transaction.getString("id"),
                    type = transaction.optString("type"),
                    points = transaction.optInt("points"),
                    reason = transaction.optString("reason"),
                    createdAt = transaction.optString("createdAt"),
                    serviceNumber = transaction.optJSONObject("order")?.nullableString("serviceNumber")
                        ?: transaction.optJSONObject("craftOrder")?.nullableString("serviceNumber"),
                )
            },
        )
    }

    private fun JSONObject.toSiteBanner() = SiteBanner(
        id = getString("id"),
        title = getString("title"),
        content = optString("content"),
        imageObjectId = nullableString("imageObjectId"),
        targetUrl = nullableString("targetUrl"),
        placements = optJSONArray("placements")?.let { values ->
            List(values.length()) { index -> values.getString(index) }
        }.orEmpty(),
        startsAt = nullableString("startsAt"),
        endsAt = nullableString("endsAt"),
        isActive = optBoolean("isActive"),
    )

    private fun List<String>.toJsonArray() = JSONArray().apply { forEach(::put) }

    private inline fun <T> JSONArray.toObjects(transform: (JSONObject) -> T): List<T> =
        List(length()) { index -> transform(getJSONObject(index)) }
}
