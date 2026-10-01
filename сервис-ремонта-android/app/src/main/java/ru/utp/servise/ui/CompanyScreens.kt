package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CompanyInfo
import ru.utp.servise.data.CompanySocial

@Composable
fun CompanyScreen(
    token: String,
    canEdit: Boolean,
    busy: Boolean,
    runAction: RunAction,
    onBack: (() -> Unit)?,
) {
    val scope = rememberCoroutineScope()
    var company by remember { mutableStateOf<CompanyInfo?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(reloadKey) {
        loading = true
        error = null
        runCatching { withContext(Dispatchers.IO) { ApiClient.companyInfo() } }
            .onSuccess { company = it }
            .onFailure { error = it.message ?: "Не удалось загрузить сведения о компании." }
        loading = false
    }

    val currentCompany = company
    if (editing && canEdit && currentCompany != null) {
        CompanyEditorScreen(
            company = currentCompany,
            busy = busy,
            onCancel = { editing = false },
            onSave = { updated ->
                runAction({ ApiClient.updateCompanyInfo(token, updated) }) { result ->
                    (result as? CompanyInfo)?.let {
                        company = it
                        editing = false
                    }
                }
            },
        )
    } else {
        val uriHandler = LocalUriHandler.current
        Column(
            Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                if (onBack != null) TextButton(onClick = onBack) { Text("←  Назад") }
                Text("О компании", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk, modifier = Modifier.weight(1f))
                TextButton(onClick = { reloadKey += 1 }, enabled = !loading) { Text("Обновить") }
            }
            if (loading && currentCompany == null) {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    CircularProgressIndicator()
                    Text("Загружаем информацию…", color = UtpMuted)
                }
            }
            error?.let { Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.error) }
            currentCompany?.let { info ->
                Text(info.name, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                CompanyInfoCard("О нас", info.description)
                CompanyInfoCard("Наша история", info.history)
                if (info.services.isNotEmpty()) {
                    Card(
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Услуги", fontWeight = FontWeight.SemiBold, color = UtpInk)
                            info.services.forEach { Text("•  $it", color = UtpMuted, lineHeight = 21.sp) }
                        }
                    }
                }
                val contacts = listOfNotNull(
                    info.phone.takeIf(String::isNotBlank)?.let {
                        Triple("Телефон", it, "tel:${it.filter { char -> char.isDigit() || char == '+' }}")
                    },
                    info.email.takeIf(String::isNotBlank)?.let { Triple("Электронная почта", it, "mailto:$it") },
                    info.address.takeIf(String::isNotBlank)?.let { Triple("Адрес", it, null) },
                    info.hours.takeIf(String::isNotBlank)?.let { Triple("График работы", it, null) },
                )
                if (contacts.isNotEmpty()) {
                    Card(
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Контакты", fontWeight = FontWeight.SemiBold, color = UtpInk)
                            contacts.forEach { (label, value, uri) ->
                                if (uri != null) {
                                    TextButton(onClick = { runCatching { uriHandler.openUri(uri) } }) {
                                        Text("$label: $value")
                                    }
                                } else {
                                    Text("$label: $value", color = UtpMuted, lineHeight = 21.sp)
                                }
                            }
                            info.socials.forEach { social ->
                                OutlinedButton(onClick = { runCatching { uriHandler.openUri(social.url) } }) {
                                    Text(social.label)
                                }
                            }
                        }
                    }
                }
                CompanyInfoCard("Реквизиты", info.requisites)
                if (info.mediaUrls.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Фото и видео", fontWeight = FontWeight.SemiBold, color = UtpInk)
                        info.mediaUrls.forEach { url -> CompanyMediaPreview(url) }
                    }
                }
                if (canEdit) {
                    Spacer(Modifier.height(4.dp))
                    Button(onClick = { editing = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Редактировать информацию")
                    }
                }
            }
            if (error != null && currentCompany == null && !loading) {
                OutlinedButton(onClick = { reloadKey += 1 }, modifier = Modifier.fillMaxWidth()) { Text("Повторить") }
            }
        }
    }
}

@Composable
private fun CompanyInfoCard(title: String, value: String) {
    if (value.isBlank()) return
    Card(
        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(value, color = UtpMuted, lineHeight = 21.sp, modifier = Modifier.padding(top = 7.dp))
        }
    }
}
