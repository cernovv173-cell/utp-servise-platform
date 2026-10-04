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

data class ReceiptDraftItemQuantity(val itemId: String, val quantity: Int)

data class FreeSaleReceiptDraftItem(
    val type: String,
    val name: String,
    val quantity: Int,
    val unitPriceRub: Int,
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
    val archivedAt: String? = null,
    val intake: RepairOrderIntake? = null,
    val warranty: RepairWarranty? = null,
)

data class RepairOrderIntake(
    val frontCondition: String = "",
    val frontPhotoObjectId: String? = null,
    val backCondition: String = "",
    val backPhotoObjectId: String? = null,
    val leftCondition: String = "",
    val leftPhotoObjectId: String? = null,
    val rightCondition: String = "",
    val rightPhotoObjectId: String? = null,
    val serialNumber: String? = null,
    val includedAccessories: String = "",
    val intakeNotes: String = "",
)

data class RepairWarranty(
    val warrantyNumber: String,
    val customerName: String,
    val deviceType: String,
    val repairSummary: String,
    val warrantyDays: Int,
    val terms: String,
    val issuedAt: String,
    val expiresAt: String,
)

data class PickupCode(val qrPayload: String, val expiresAt: String)

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

data class SalaryAmounts(val day: Int = 0, val week: Int = 0, val month: Int = 0)
data class SalaryRange(val startsAt: String = "", val endsAt: String = "")
data class SalaryTechnician(
    val id: String,
    val displayName: String,
    val amounts: SalaryAmounts,
)
data class SalarySummary(
    val ratePercent: Int = 75,
    val timeZone: String = "UTC",
    val dayRange: SalaryRange = SalaryRange(),
    val weekRange: SalaryRange = SalaryRange(),
    val monthRange: SalaryRange = SalaryRange(),
    val totals: SalaryAmounts = SalaryAmounts(),
    val technicians: List<SalaryTechnician> = emptyList(),
)

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
    val stockQuantity: Int? = null,
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

data class SupportChatMessage(
    val id: String,
    val senderId: String?,
    val senderName: String,
    val senderRole: String,
    val content: String,
    val createdAt: String,
)

data class SupportChat(
    val id: String?,
    val customerId: String,
    val customerName: String,
    val customerEmail: String,
    val messages: List<SupportChatMessage>,
)

data class SupportChatInboxItem(
    val customerId: String,
    val customerName: String,
    val customerEmail: String,
    val lastMessage: String,
    val updatedAt: String,
)

data class AdminCustomer(
    val id: String,
    val email: String,
    val displayName: String,
    val phoneNumber: String?,
    val active: Boolean,
    val createdAt: String,
)

data class AdminCustomerPage(
    val customers: List<AdminCustomer>,
    val page: Int,
    val totalPages: Int,
    val totalItems: Int,
)

data class NewAdminCustomerResult(
    val customer: AdminCustomer,
    val temporaryPassword: String,
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
