package ru.utp.servise

import ru.utp.servise.data.AdminChatInboxItem
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.CustomerDevice
import ru.utp.servise.data.CustomerServicePrice
import ru.utp.servise.data.CustomerOffer
import ru.utp.servise.data.LoyaltyAccount
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.ReferralProgram
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.SalarySummary
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.SupportChatInboxItem

internal data class WorkspaceData(
    val orders: List<RepairOrder>,
    val reviews: List<CustomerReview>,
    val customerDevices: List<CustomerDevice>,
    val customerServicePrices: List<CustomerServicePrice>,
    val staff: List<StaffMember>,
    val catalogItems: List<CatalogItem>,
    val craftItems: List<CraftItem>,
    val craftOrders: List<CraftOrder>,
    val news: List<NewsArticle>,
    val customerOffers: List<CustomerOffer>,
    val banners: List<SiteBanner>,
    val loyalty: LoyaltyAccount,
    val referralProgram: ReferralProgram,
    val salary: SalarySummary,
    val adminChats: List<AdminChatInboxItem>,
    val supportChats: List<SupportChatInboxItem>,
)
