package ru.utp.servise.data

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONObject.toUser() = AppUser(
    id = getString("id"),
    email = getString("email"),
    displayName = getString("displayName"),
    phoneNumber = nullableString("phoneNumber"),
    gender = nullableString("gender"),
    birthDate = nullableString("birthDate"),
    telegramLinked = optBoolean("telegramLinked"),
    maxLinked = optBoolean("maxLinked"),
    maxAvailable = optBoolean("maxAvailable"),
    avatarObjectId = nullableString("avatarObjectId"),
    role = getString("role"),
    mustChangePassword = optBoolean("mustChangePassword"),
)

internal fun JSONObject.toOrder(): RepairOrder {
    val technician = optJSONObject("assignedTechnician")
    val customer = optJSONObject("customer")
    val statusEvents = optJSONArray("statusEvents")
    val items = optJSONArray("items")
    val existingReview = optJSONObject("review")
    return RepairOrder(
        id = getString("id"),
        deviceType = getString("deviceType"),
        problem = getString("problem"),
        address = getString("address"),
        status = getString("status"),
        diagnosisCompletedAt = nullableString("diagnosisCompletedAt"),
        createdAt = optString("createdAt"),
        archivedAt = nullableString("archivedAt"),
        customerName = customer?.optString("displayName").orEmpty(),
        customerPhoneNumber = customer?.nullableString("phoneNumber"),
        customerAvatarObjectId = customer?.nullableString("avatarObjectId"),
        technicianName = technician?.optString("displayName").orEmpty(),
        technicianPhoneNumber = technician?.nullableString("phoneNumber"),
        technicianAvatarObjectId = technician?.nullableString("avatarObjectId"),
        hasReview = existingReview != null && existingReview.length() > 0,
        history = statusEvents.mapObjects { event ->
            val from = event.nullableString("from")
            val to = event.optString("to")
            val note = event.nullableString("note")
            val actor = event.optJSONObject("actor")?.optString("displayName").orEmpty()
            listOfNotNull(
                from?.let { "${it.statusLabel()} → ${to.statusLabel()}" },
                to.statusLabel().takeIf { from == null },
                note,
                actor.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
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
        photos = optJSONArray("photos").mapObjects { photo ->
            RepairOrderPhoto(photo.getString("id"), photo.getString("objectId"))
        },
        serviceNumber = nullableString("serviceNumber") ?: getString("id"),
        expectedCompletionAt = nullableString("expectedCompletionAt"),
        bonusDiscountRub = optInt("bonusDiscountRub"),
        redeemBonuses = optBoolean("redeemBonuses"),
        contactPhone = nullableString("contactPhone"),
        city = nullableString("city"),
        street = nullableString("street"),
        house = nullableString("house"),
        apartment = nullableString("apartment"),
        entrance = nullableString("entrance"),
        hasBarrier = optBoolean("hasBarrier"),
        floor = nullableString("floor"),
        additionalPhone = nullableString("additionalPhone"),
        additionalInfo = nullableString("additionalInfo"),
        receipt = optJSONObject("receipt")?.toRepairReceipt(),
        intake = optJSONObject("intake")?.toRepairOrderIntake(),
        warranty = optJSONObject("warranty")?.toRepairWarranty(),
    )
}

internal fun JSONObject.toRepairOrderIntake() = RepairOrderIntake(
    frontCondition = optString("frontCondition"),
    frontPhotoObjectId = nullableString("frontPhotoObjectId"),
    backCondition = optString("backCondition"),
    backPhotoObjectId = nullableString("backPhotoObjectId"),
    leftCondition = optString("leftCondition"),
    leftPhotoObjectId = nullableString("leftPhotoObjectId"),
    rightCondition = optString("rightCondition"),
    rightPhotoObjectId = nullableString("rightPhotoObjectId"),
    serialNumber = nullableString("serialNumber"),
    includedAccessories = optString("includedAccessories"),
    intakeNotes = optString("intakeNotes"),
)

private fun JSONObject.toRepairWarranty() = RepairWarranty(
    warrantyNumber = optString("warrantyNumber"),
    customerName = optString("customerName"),
    deviceType = optString("deviceType"),
    repairSummary = optString("repairSummary"),
    warrantyDays = optInt("warrantyDays"),
    terms = optString("terms"),
    issuedAt = optString("issuedAt"),
    expiresAt = optString("expiresAt"),
)

internal fun JSONObject.toRepairReceipt() = RepairReceipt(
    id = getString("id"),
    receiptNumber = getString("receiptNumber"),
    serviceNumber = getString("serviceNumber"),
    customerName = getString("customerName"),
    customerPhone = nullableString("customerPhone"),
    issuedAt = optString("issuedAt"),
    items = optJSONArray("itemsSnapshot").mapObjects { item ->
        ReceiptItem(
            name = item.optString("name"),
            quantity = item.optInt("quantity"),
            unitPriceRub = item.optInt("unitPriceRub"),
            totalRub = item.optInt("totalRub"),
        )
    },
    totalRub = optInt("totalRub"),
    bonusDiscountRub = optInt("bonusDiscountRub"),
    paymentStatus = optString("paymentStatus", "PENDING"),
    paymentMethod = nullableString("paymentMethod"),
    paidAt = nullableString("paidAt"),
)

internal fun JSONObject.toSalarySummary(): SalarySummary {
    val ranges = optJSONObject("ranges") ?: JSONObject()
    val totals = optJSONObject("totals") ?: JSONObject()
    return SalarySummary(
        ratePercent = optInt("ratePercent", 75),
        timeZone = optString("timeZone", "UTC"),
        dayRange = ranges.optJSONObject("day")?.toSalaryRange() ?: SalaryRange(),
        weekRange = ranges.optJSONObject("week")?.toSalaryRange() ?: SalaryRange(),
        monthRange = ranges.optJSONObject("month")?.toSalaryRange() ?: SalaryRange(),
        totals = totals.toSalaryAmounts(),
        technicians = optJSONArray("technicians").mapObjects { technician ->
            SalaryTechnician(
                id = technician.getString("id"),
                displayName = technician.optString("displayName"),
                amounts = technician.optJSONObject("amounts")?.toSalaryAmounts() ?: SalaryAmounts(),
            )
        },
    )
}

private fun JSONObject.toSalaryRange() = SalaryRange(
    startsAt = optString("startsAt"),
    endsAt = optString("endsAt"),
)

private fun JSONObject.toSalaryAmounts() = SalaryAmounts(
    day = optInt("day"),
    week = optInt("week"),
    month = optInt("month"),
)

internal fun JSONObject.toStaff() = StaffMember(
    id = getString("id"),
    email = getString("email"),
    displayName = getString("displayName"),
    phoneNumber = nullableString("phoneNumber"),
    avatarObjectId = nullableString("avatarObjectId"),
    role = getString("role"),
    active = optBoolean("active", true),
    salaryRatePercent = optInt("salaryRatePercent", 75),
)

internal fun JSONObject.toCatalogItem() = CatalogItem(
    id = getString("id"),
    type = getString("type"),
    name = getString("name"),
    unitPriceRub = getInt("unitPriceRub"),
    active = optBoolean("active", true),
    stockQuantity = if (isNull("stockQuantity")) null else optInt("stockQuantity"),
)

internal fun JSONObject.toCraftItem() = CraftItem(
    id = getString("id"),
    title = getString("title"),
    description = optString("description"),
    priceRub = optInt("priceRub"),
    imageObjectId = nullableString("imageObjectId"),
    isPublished = optBoolean("isPublished"),
    customOrderAvailable = optBoolean("customOrderAvailable", true),
)

internal fun JSONObject.toCraftOrder(): CraftOrder {
    val customer = optJSONObject("customer")
    val technician = optJSONObject("assignedTechnician")
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
        customerPhone = customer?.nullableString("phoneNumber"),
        serviceNumber = nullableString("serviceNumber"),
        assignedTechnicianId = nullableString("assignedTechnicianId"),
        assignedTechnicianName = technician?.optString("displayName"),
        assignedTechnicianRatePercent = technician?.optInt("salaryRatePercent"),
        redeemBonuses = optBoolean("redeemBonuses"),
        bonusDiscountRub = optInt("bonusDiscountRub"),
        receipt = optJSONObject("receipt")?.toCraftOrderReceipt(),
        salaryEntry = optJSONObject("salaryEntry")?.let { entry ->
            CraftOrderSalaryEntry(
                serviceTotalRub = entry.optInt("serviceTotalRub"),
                salaryRub = entry.optInt("salaryRub"),
                ratePercent = entry.optInt("ratePercent", 75),
            )
        },
    )
}

internal fun JSONObject.toCraftOrderReceipt() = CraftOrderReceipt(
    receiptNumber = optString("receiptNumber"),
    serviceNumber = optString("serviceNumber"),
    items = optJSONArray("itemsSnapshot").mapObjects { item ->
        ReceiptItem(
            name = item.optString("name"),
            quantity = item.optInt("quantity"),
            unitPriceRub = item.optInt("unitPriceRub"),
            totalRub = item.optInt("totalRub"),
        )
    },
    totalRub = optInt("totalRub"),
    bonusDiscountRub = optInt("bonusDiscountRub"),
    paymentStatus = optString("paymentStatus", "PENDING"),
    paymentMethod = nullableString("paymentMethod"),
    paidAt = nullableString("paidAt"),
)

internal fun JSONObject.toCraftOrderChatMessage() = CraftOrderChatMessage(
    id = getString("id"),
    senderId = nullableString("senderId"),
    senderName = optJSONObject("sender")?.optString("displayName").orEmpty(),
    senderRole = optJSONObject("sender")?.optString("role").orEmpty(),
    content = optString("content"),
    imageObjectId = nullableString("imageObjectId"),
    createdAt = optString("createdAt"),
)

internal fun JSONObject.toCraftOrderChat(): CraftOrderChat {
    val chat = getJSONObject("chat")
    return CraftOrderChat(
        craftOrderId = chat.getString("craftOrderId"),
        messages = chat.getJSONArray("messages").mapObjects { it.toCraftOrderChatMessage() },
    )
}

internal fun JSONObject.toNewsArticle() = NewsArticle(
    id = getString("id"),
    title = getString("title"),
    content = getString("content"),
    isPublished = optBoolean("isPublished"),
    publishedAt = nullableString("publishedAt"),
    imageObjectId = nullableString("imageObjectId"),
    startsAt = nullableString("startsAt"),
    endsAt = nullableString("endsAt"),
    isFeatured = optBoolean("isFeatured"),
)

internal fun JSONObject.toOrderChat() = OrderChat(
    id = nullableString("id"),
    orderId = getString("orderId"),
    adminRequestedAt = nullableString("adminRequestedAt"),
    adminRequestedByName = optJSONObject("requestedBy")?.optString("displayName").orEmpty(),
    adminJoinedAt = nullableString("adminJoinedAt"),
    adminJoinedByName = optJSONObject("joinedBy")?.optString("displayName").orEmpty(),
    messages = optJSONArray("messages").mapObjects { message ->
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

internal fun JSONObject.toAdminChatInboxItem(): AdminChatInboxItem {
    val order = optJSONObject("order") ?: JSONObject()
    val lastMessage = optJSONArray("messages")?.optJSONObject(0)
    return AdminChatInboxItem(
        orderId = order.optString("id"),
        deviceType = order.optString("deviceType"),
        problem = order.optString("problem"),
        customerName = order.optJSONObject("customer")?.optString("displayName").orEmpty(),
        technicianName = order.optJSONObject("assignedTechnician")?.optString("displayName").orEmpty(),
        lastMessage = lastMessage?.optString("content").orEmpty(),
        adminJoinedAt = nullableString("adminJoinedAt"),
    )
}

internal fun JSONObject.toSupportChat(): SupportChat {
    val customer = optJSONObject("customer")
    return SupportChat(
        id = nullableString("id"),
        customerId = getString("customerId"),
        customerName = customer?.optString("displayName").orEmpty(),
        customerEmail = customer?.optString("email").orEmpty(),
        messages = optJSONArray("messages").mapObjects { message ->
            val sender = message.optJSONObject("sender")
            SupportChatMessage(
                id = message.getString("id"),
                senderId = message.nullableString("senderId"),
                senderName = sender?.optString("displayName").orEmpty().ifBlank { "Пользователь" },
                senderRole = sender?.optString("role").orEmpty(),
                content = message.getString("content"),
                createdAt = message.optString("createdAt"),
            )
        },
    )
}

internal fun JSONObject.toSupportChatInboxItem(): SupportChatInboxItem {
    val customer = optJSONObject("customer") ?: JSONObject()
    val lastMessage = optJSONArray("messages")?.optJSONObject(0)
    return SupportChatInboxItem(
        customerId = customer.optString("id"),
        customerName = customer.optString("displayName"),
        customerEmail = customer.optString("email"),
        lastMessage = lastMessage?.optString("content").orEmpty(),
        updatedAt = optString("updatedAt"),
    )
}

internal fun JSONObject.toAdminCustomer() = AdminCustomer(
    id = getString("id"),
    email = getString("email"),
    displayName = getString("displayName"),
    phoneNumber = nullableString("phoneNumber"),
    active = optBoolean("active", true),
    createdAt = optString("createdAt"),
)

internal fun JSONObject.toReview(): CustomerReview {
    val order = optJSONObject("order") ?: JSONObject()
    val technician = order.optJSONObject("assignedTechnician")
    val customer = optJSONObject("customer")
    return CustomerReview(
        id = getString("id"),
        orderId = getString("orderId"),
        customerName = customer?.optString("displayName").orEmpty(),
        rating = getInt("rating"),
        comment = getString("comment"),
        deviceType = order.optString("deviceType"),
        technicianName = technician?.optString("displayName").orEmpty(),
        isPublished = optBoolean("isPublished"),
        imageObjectId = nullableString("imageObjectId"),
        createdAt = optString("createdAt"),
    )
}

internal inline fun <T> JSONArray?.mapObjects(transform: (JSONObject) -> T): List<T> =
    this?.let { array ->
        (0 until array.length()).mapNotNull { index -> array.optJSONObject(index)?.let(transform) }
    }.orEmpty()

internal fun JSONArray?.strings(): List<String> =
    this?.let { array -> (0 until array.length()).map { index -> array.optString(index) } }.orEmpty()

internal fun JSONObject.nullableString(key: String): String? =
    optString(key).takeUnless { it.isBlank() || it == "null" }

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
    "READY_FOR_PICKUP" -> "Готов к выдаче"
    "COMPLETED" -> "Завершена"
    "CANCELLED" -> "Отменена"
    else -> this
}

fun String.orderItemTypeLabel(): String = when (this) {
    "SERVICE" -> "Услуга"
    "SPARE_PART" -> "Запчасть"
    "PRODUCT" -> "Товар"
    else -> this
}

fun String.roleLabel(): String = when (this) {
    "CUSTOMER" -> "Клиент"
    "TECHNICIAN" -> "Мастер"
    "ADMIN" -> "Администратор"
    else -> this
}
