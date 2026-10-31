package ru.utp.servise.ui

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler

private const val PRIVACY_POLICY_URL =
    "https://xn----dtbhbq0ahshee.xn--p1ai/privacy-policy.html"

@Composable
internal fun PrivacyPolicyLink(modifier: Modifier = Modifier) {
    val uriHandler = LocalUriHandler.current

    TextButton(
        onClick = { uriHandler.openUri(PRIVACY_POLICY_URL) },
        modifier = modifier,
    ) {
        Text("Политика конфиденциальности")
    }
}
