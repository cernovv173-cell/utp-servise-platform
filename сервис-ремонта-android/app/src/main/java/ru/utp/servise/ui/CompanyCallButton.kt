package ru.utp.servise.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext

@Composable
internal fun CompanyCallButton(
    phone: String?,
    modifier: Modifier = Modifier,
    label: String = "Позвонить",
) {
    val context = LocalContext.current
    val dialable = phone.orEmpty().filter { it.isDigit() || it == '+' }
    Button(
        onClick = {
            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$dialable")))
        },
        enabled = dialable.count(Char::isDigit) >= 7,
        modifier = modifier,
    ) {
        Icon(Icons.Filled.Call, contentDescription = null)
        Text(label)
    }
}
