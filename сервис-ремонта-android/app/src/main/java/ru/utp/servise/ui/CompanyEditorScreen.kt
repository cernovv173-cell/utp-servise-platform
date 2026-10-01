package ru.utp.servise.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CompanyInfo
import ru.utp.servise.data.CompanySocial

@Composable
fun CompanyEditorScreen(
    company: CompanyInfo,
    busy: Boolean,
    onCancel: () -> Unit,
    onSave: (CompanyInfo) -> Unit,
) {
    var name by remember(company) { mutableStateOf(company.name) }
    var description by remember(company) { mutableStateOf(company.description) }
    var history by remember(company) { mutableStateOf(company.history) }
    var services by remember(company) { mutableStateOf(company.services.joinToString("\n")) }
    var phone by remember(company) { mutableStateOf(company.phone) }
    var email by remember(company) { mutableStateOf(company.email) }
    var address by remember(company) { mutableStateOf(company.address) }
    var hours by remember(company) { mutableStateOf(company.hours) }
    var socials by remember(company) {
        mutableStateOf(company.socials.joinToString("\n") { "${it.label} | ${it.url}" })
    }
    var requisites by remember(company) { mutableStateOf(company.requisites) }
    var mediaUrls by remember(company) { mutableStateOf(company.mediaUrls.joinToString("\n")) }

    val serviceValues = services.lines().map(String::trim).filter(String::isNotEmpty)
    val socialValues = socials.lines().map(String::trim).filter(String::isNotEmpty)
    val mediaValues = mediaUrls.lines().map(String::trim).filter(String::isNotEmpty)
    val hasInvalidSocial = socialValues.any { line ->
        val parts = line.split("|", limit = 2).map(String::trim)
        parts.size != 2 || parts[0].length < 2 || !isWebUrl(parts[1])
    }
    val hasInvalidMedia = mediaValues.any { !isWebUrl(it) }
    val canSave = name.trim().length >= 2 && serviceValues.size <= 30 && serviceValues.all { it.length >= 2 } &&
        socialValues.size <= 20 && !hasInvalidSocial && mediaValues.size <= 30 && !hasInvalidMedia

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedButton(onClick = onCancel) { Text("←  К сведениям о компании") }
        Text("Редактирование раздела", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Изменения сохраняются и отображаются в приложении и на сайте.", color = UtpMuted, fontSize = 13.sp)
        CompanyField("Название компании", name, { name = it.take(120) }, max = 120)
        CompanyField("Описание деятельности", description, { description = it.take(4000) }, max = 4000, minLines = 3)
        CompanyField("История компании", history, { history = it.take(4000) }, max = 4000, minLines = 3)
        CompanyField("Услуги — по одной на строке", services, { services = it.take(5000) }, max = 5000, minLines = 4)
        CompanyField("Телефон", phone, { phone = it.take(32) }, max = 32, keyboardType = KeyboardType.Phone)
        CompanyField("Электронная почта", email, { email = it.take(320) }, max = 320, keyboardType = KeyboardType.Email)
        CompanyField("Адрес", address, { address = it.take(500) }, max = 500, minLines = 2)
        CompanyField("График работы", hours, { hours = it.take(500) }, max = 500, minLines = 2)
        CompanyField("Соцсети — «название | ссылка», по одной на строке", socials, { socials = it.take(12000) }, max = 12000, minLines = 3)
        CompanyField("Реквизиты", requisites, { requisites = it.take(2000) }, max = 2000, minLines = 3)
        CompanyField("Ссылки на фото или видео — по одной на строке", mediaUrls, { mediaUrls = it.take(12000) }, max = 12000, minLines = 3)
        Text("Для фото и видео укажите прямые ссылки на материалы.", fontSize = 12.sp, color = UtpMuted)
        if (hasInvalidSocial) Text("Проверьте соцсети: используйте формат «Название | https://…».", color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 12.sp)
        if (hasInvalidMedia) Text("Ссылки на материалы должны начинаться с http:// или https://.", color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 12.sp)
        Spacer(Modifier.height(4.dp))
        Button(onClick = {
            onSave(
                CompanyInfo(
                    name = name.trim(),
                    description = description.trim(),
                    history = history.trim(),
                    services = serviceValues,
                    phone = phone.trim(),
                    email = email.trim(),
                    address = address.trim(),
                    hours = hours.trim(),
                    socials = socialValues.map { line ->
                        val parts = line.split("|", limit = 2).map(String::trim)
                        CompanySocial(parts[0], parts[1])
                    },
                    requisites = requisites.trim(),
                    mediaUrls = mediaValues,
                ),
            )
        }, enabled = canSave && !busy, modifier = Modifier.fillMaxWidth()) {
            Text(if (busy) "Сохраняем…" else "Сохранить")
        }
    }
}

@Composable
private fun CompanyField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    max: Int,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        minLines = minLines,
        singleLine = minLines == 1,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        supportingText = { Text("${value.length}/$max") },
    )
}

private fun isWebUrl(value: String): Boolean = runCatching {
    val uri = Uri.parse(value.trim())
    uri.scheme in setOf("http", "https") && !uri.host.isNullOrBlank()
}.getOrDefault(false)
