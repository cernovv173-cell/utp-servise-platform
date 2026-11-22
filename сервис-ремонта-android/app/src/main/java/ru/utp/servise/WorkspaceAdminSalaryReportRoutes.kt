package ru.utp.servise

import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import ru.utp.servise.ui.MonthlySalaryReportsScreen

internal fun NavGraphBuilder.registerAdminSalaryReportRoute(
    token: String,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    composable("admin/salary-reports") {
        MonthlySalaryReportsScreen(token = token, onError = onError, onBack = onBack)
    }
}
