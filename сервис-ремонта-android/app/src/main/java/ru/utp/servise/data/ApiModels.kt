package ru.utp.servise.data

data class AppUser(
    val id: String,
    val email: String,
    val displayName: String,
    val phoneNumber: String? = null,
    val gender: String? = null,
    val birthDate: String? = null,
    val telegramLinked: Boolean = false,
    val maxLinked: Boolean = false,
    val maxAvailable: Boolean = false,
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

data class RepairRequestDetails(
    val deviceBrand: String = "",
    val deviceModel: String = "",
    val deviceSerialNumber: String = "",
    val preferredAt: String? = null,
    val customerDeviceId: String? = null,
)

data class CustomerDeviceRepair(
    val id: String,
    val serviceNumber: String,
    val problem: String,
    val status: String,
    val createdAt: String,
    val warrantyNumber: String?,
    val warrantyExpiresAt: String?,
    val receiptNumber: String?,
    val warrantyOriginOrderServiceNumber: String? = null,
)

data class CustomerDevice(
    val id: String,
    val deviceType: String,
    val nickname: String?,
    val brand: String?,
    val model: String?,
    val serialNumber: String?,
    val nextMaintenanceAt: String?,
    val maintenanceNote: String?,
    val repairOrders: List<CustomerDeviceRepair> = emptyList(),
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
    val diagnosisCompletedAt: String? = null,
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
    val estimates: List<RepairEstimate> = emptyList(),
    val deadlineChanges: List<RepairOrderDeadlineChange> = emptyList(),
    val deviceBrand: String? = null,
    val deviceModel: String? = null,
    val deviceSerialNumber: String? = null,
    val preferredAt: String? = null,
    val priority: String = "NORMAL",
    val repairLocation: String? = null,
)

data class OperationsDashboard(
    val periodDays: Int,
    val activeOrders: Int,
    val overdueOrders: Int,
    val newOrders: Int,
    val completedOrders: Int,
    val averageRepairMinutes: Int?,
    val collectedRub: Int,
    val popularWorks: List<PopularWork>,
)

data class PopularWork(val name: String, val completedQuantity: Int)

data class ProcurementItem(
    val id: String,
    val name: String,
    val stockQuantity: Int,
    val minimumStockQuantity: Int,
    val unitPriceRub: Int,
    val recommendedPurchase: Int,
    val activeEstimateQuantity: Int,
)

data class ScheduledRepairOrder(
    val id: String,
    val serviceNumber: String,
    val deviceType: String,
    val deviceBrand: String?,
    val deviceModel: String?,
    val problem: String,
    val preferredAt: String?,
    val expectedCompletionAt: String?,
    val status: String,
    val priority: String,
    val city: String?,
    val street: String?,
    val house: String?,
    val customerName: String,
    val technicianId: String?,
    val technicianName: String?,
)

data class RepairOrderDeadlineChange(
    val id: String,
    val previousExpectedAt: String?,
    val expectedCompletionAt: String?,
    val note: String?,
    val createdAt: String,
    val actorName: String?,
)

data class RepairEstimate(
    val id: String,
    val orderId: String,
    val version: Int,
    val kind: String,
    val status: String,
    val diagnosis: String,
    val itemsSnapshot: List<RepairEstimateItem>,
    val totalRub: Int,
    val customerResponseNote: String?,
    val submittedAt: String,
    val respondedAt: String?,
    val createdByName: String?,
)

data class RepairEstimateItem(
    val catalogItemId: String,
    val type: String,
    val name: String,
    val quantity: Int,
    val unitPriceRub: Int,
)

data class RepairEstimateDraftItem(val catalogItemId: String, val quantity: Int)

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

data class PickupCode(val qrPayload: String, val fallbackPin: String, val expiresAt: String)

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

data class ReferralEntry(
    val id: String,
    val status: String,
    val createdAt: String,
    val rewardedAt: String?,
)

data class ReferralProgram(
    val referralCode: String = "",
    val totalInvites: Int = 0,
    val pendingCount: Int = 0,
    val rewardedCount: Int = 0,
    val referrals: List<ReferralEntry> = emptyList(),
)

data class SeasonalThemeState(
    val activeSeason: String = "NONE",
    val activatedAt: String? = null,
    val loaded: Boolean = false,
)

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
    val minimumStockQuantity: Int? = null,
    val description: String? = null,
    val imageObjectIds: List<String> = emptyList(),
)

data class ShopProduct(
    val id: String,
    val name: String,
    val unitPriceRub: Int,
    val availability: String,
    val description: String? = null,
    val imageObjectIds: List<String> = emptyList(),
)

data class ShopOrderItem(
    val id: String,
    val catalogItemId: String?,
    val name: String,
    val quantity: Int,
    val unitPriceRub: Int,
    val stockDeducted: Boolean,
)

data class ShopOrderCustomer(
    val id: String,
    val displayName: String,
    val email: String,
    val phoneNumber: String?,
)

data class ShopOrder(
    val id: String,
    val status: String,
    val customerNote: String?,
    val totalRub: Int,
    val createdAt: String,
    val confirmedAt: String?,
    val completedAt: String?,
    val cancelledAt: String?,
    val items: List<ShopOrderItem>,
    val customer: ShopOrderCustomer? = null,
    val deliveryMethod: String = "PICKUP",
    val deliveryArea: String? = null,
    val deliveryCity: String? = null,
    val deliveryAddress: String? = null,
    val deliveryRequestNote: String? = null,
    val deliveryFeeRub: Int? = null,
    val deliveryWindow: String? = null,
    val deliveryOfferAcceptedAt: String? = null,
)

data class CustomerServicePrice(
    val id: String,
    val name: String,
    val unitPriceRub: Int,
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

data class CraftOrderReceipt(
    val receiptNumber: String,
    val serviceNumber: String,
    val items: List<ReceiptItem>,
    val totalRub: Int,
    val bonusDiscountRub: Int,
    val paymentStatus: String,
    val paymentMethod: String?,
    val paidAt: String?,
)

data class CraftOrderSalaryEntry(
    val serviceTotalRub: Int,
    val salaryRub: Int,
    val ratePercent: Int,
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
    val serviceNumber: String? = null,
    val assignedTechnicianId: String? = null,
    val assignedTechnicianName: String? = null,
    val assignedTechnicianRatePercent: Int? = null,
    val redeemBonuses: Boolean = false,
    val bonusDiscountRub: Int = 0,
    val receipt: CraftOrderReceipt? = null,
    val salaryEntry: CraftOrderSalaryEntry? = null,
)

data class CraftOrderChatMessage(
    val id: String,
    val senderId: String?,
    val senderName: String,
    val senderRole: String,
    val content: String,
    val imageObjectId: String?,
    val createdAt: String,
)

data class CraftOrderChat(
    val craftOrderId: String,
    val messages: List<CraftOrderChatMessage>,
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

data class TechnologyFact(
    val id: String,
    val title: String,
    val content: String,
    val sourceName: String,
    val sourceUrl: String,
    val updatedAt: String,
    val nextUpdateAt: String,
)

data class NewsFeed(
    val articles: List<NewsArticle>,
    val technologyFact: TechnologyFact?,
)

data class CustomerOfferParticipation(
    val id: String,
    val joinedAt: String,
    val place: Int?,
)

data class CustomerOfferWinner(
    val place: Int,
    val displayName: String,
    val prize: String?,
    val bonusPoints: Int,
)

data class PublicCustomerOffer(
    val id: String,
    val type: String,
    val title: String,
    val content: String,
    val firstPlacePrize: String?,
    val firstPlacePoints: Int,
    val secondPlacePrize: String?,
    val secondPlacePoints: Int,
    val thirdPlacePrize: String?,
    val thirdPlacePoints: Int,
    val startsAt: String,
    val endsAt: String,
)

data class CustomerOffer(
    val id: String,
    val type: String,
    val title: String,
    val content: String,
    val firstPlacePrize: String?,
    val firstPlacePoints: Int,
    val secondPlacePrize: String?,
    val secondPlacePoints: Int,
    val thirdPlacePrize: String?,
    val thirdPlacePoints: Int,
    val isPublished: Boolean,
    val startsAt: String,
    val endsAt: String,
    val drawnAt: String?,
    val resultsPublishedAt: String?,
    val participantCount: Int,
    val myParticipation: CustomerOfferParticipation?,
    val winners: List<CustomerOfferWinner>,
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
    val salaryRatePercent: Int = 75,
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

data class PublicReview(
    val id: String,
    val rating: Int,
    val comment: String,
    val createdAt: String,
    val customerName: String,
    val deviceType: String,
)

data class AuthResult(val accessToken: String, val user: AppUser)
data class NewStaffResult(val staff: StaffMember, val temporaryPassword: String)
