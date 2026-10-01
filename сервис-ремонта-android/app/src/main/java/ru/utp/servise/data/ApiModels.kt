package ru.utp.servise.data

data class AppUser(
    val id: String,
    val email: String,
    val displayName: String,
    val phoneNumber: String? = null,
    val avatarObjectId: String? = null,
    val role: String,
    val mustChangePassword: Boolean,
)

data class OrderAddress(
    val contactPhone: String,
    val city: String,
    val street: String,
    val house: String,
    val apartment: String = "",
    val entrance: String = "",
    val hasBarrier: Boolean = false,
    val floor: String = "",
    val additionalPhone: String = "",
    val additionalInfo: String = "",
)

data class ReceiptItem(
    val name: String,
    val quantity: Int,
    val unitPriceRub: Int,
    val totalRub: Int,
)

data class RepairReceipt(
    val id: String,
    val receiptNumber: String,
    val serviceNumber: String,
    val customerName: String,
    val customerPhone: String?,
    val issuedAt: String,
    val items: List<ReceiptItem>,
    val totalRub: Int,
    val bonusDiscountRub: Int,
    val paymentStatus: String,
    val paymentMethod: String?,
    val paidAt: String?,
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
    val contactPhone: String? = null,
    val city: String? = null,
    val street: String? = null,
    val house: String? = null,
    val apartment: String? = null,
    val entrance: String? = null,
    val hasBarrier: Boolean = false,
    val floor: String? = null,
    val additionalPhone: String? = null,
    val additionalInfo: String? = null,
    val receipt: RepairReceipt? = null,
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

data class LoyaltyTransaction(
    val id: String,
    val type: String,
    val points: Int,
    val reason: String,
    val createdAt: String,
    val serviceNumber: String?,
)

data class LoyaltyAccount(val balance: Int, val transactions: List<LoyaltyTransaction>)

data class SiteBanner(
    val id: String,
    val title: String,
    val content: String,
    val imageObjectId: String?,
    val targetUrl: String?,
    val placements: List<String>,
    val startsAt: String?,
    val endsAt: String?,
    val isActive: Boolean,
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
    val isPublished: Boolean = false,
    val imageObjectId: String? = null,
    val createdAt: String = "",
)

data class AuthResult(val accessToken: String, val user: AppUser)
data class NewStaffResult(val staff: StaffMember, val temporaryPassword: String)
