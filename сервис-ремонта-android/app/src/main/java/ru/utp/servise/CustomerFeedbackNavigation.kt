package ru.utp.servise

import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import ru.utp.servise.ui.CustomerFeedbackScreen
import ru.utp.servise.ui.RunAction

internal fun NavGraphBuilder.addCustomerFeedbackRoute(
    role: String,
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onBack: () -> Unit,
) {
    if (role != "CUSTOMER") return

    composable("customer/feedback") {
        CustomerFeedbackScreen(
            token = token,
            busy = busy,
            runAction = runAction,
            onBack = onBack,
        )
    }
}
