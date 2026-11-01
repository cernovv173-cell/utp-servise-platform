package ru.utp.servise

import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import ru.utp.servise.ui.AdminBannerManagementScreen
import ru.utp.servise.ui.AdminLoyaltyHistoryScreen
import ru.utp.servise.ui.AdminOfferManagementScreen
import ru.utp.servise.ui.RunAction

internal fun NavGraphBuilder.registerAdminCampaignRoutes(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    composable("admin/offers") {
        AdminOfferManagementScreen(token, busy, runAction, onError, onBack)
    }
    composable("admin/banners") {
        AdminBannerManagementScreen(token, busy, runAction, onError, onBack)
    }
    composable("admin/loyalty") {
        AdminLoyaltyHistoryScreen(token, onError, onBack)
    }
}
