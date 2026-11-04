package ru.utp.servise.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.AdminMarketingApi
import ru.utp.servise.data.SiteBanner
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val bannerPlacements = listOf(
    "HOME" to "Главная",
    "NEWS" to "Новости",
    "SERVICE" to "Услуги",
    "CRAFTS" to "Рукоделия",
    "ABOUT" to "О компании",
    "LOYALTY" to "Бонусы",
)

private data class BannerConfirmation(
    val title: String,
    val message: String,
    val action: () -> Any?,
)

private data class BannerSaveResult(val banner: SiteBanner, val mediaError: String?)

@Composable
fun AdminBannerManagementScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var banners by remember { mutableStateOf(emptyList<SiteBanner>()) }
    var loading by remember { mutableStateOf(true) }
    var editing by remember { mutableStateOf<SiteBanner?>(null) }
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var targetUrl by remember { mutableStateOf("app://home") }
    var startsAt by remember { mutableStateOf<String?>(null) }
    var endsAt by remember { mutableStateOf<String?>(null) }
    var placements by remember { mutableStateOf(setOf("HOME")) }
    var selectedMedia by remember { mutableStateOf<Uri?>(null) }
    var confirmation by remember { mutableStateOf<BannerConfirmation?>(null) }

    fun reload() {
        scope.launch {
            loading = true
            try {
                banners = withContext(Dispatchers.IO) { AdminMarketingApi.banners(token) }
            } catch (failure: Throwable) {
                onError(failure.message ?: "Не удалось загрузить баннеры.")
            } finally {
                loading = false
            }
        }
    }

    fun clearForm() {
        editing = null
        title = ""
        content = ""
        targetUrl = "app://home"
        startsAt = null
        endsAt = null
        placements = setOf("HOME")
        selectedMedia = null
    }

    fun editBanner(banner: SiteBanner) {
        editing = banner
        title = banner.title
        content = banner.content
        targetUrl = banner.targetUrl.orEmpty()
        startsAt = banner.startsAt
        endsAt = banner.endsAt
        placements = banner.placements.toSet()
        selectedMedia = null
    }

    LaunchedEffect(token) { reload() }
    val validTarget = targetUrl.isBlank() || isAllowedBannerTarget(targetUrl.trim())
    val validSchedule = runCatching {
        val start = startsAt?.let(Instant::parse)
        val end = endsAt?.let(Instant::parse)
        start == null || end == null || start.isBefore(end)
    }.getOrDefault(false)
    val keepsActiveBannerValid = editing?.isActive != true ||
        (editing?.imageObjectId != null || editing?.videoObjectId != null || selectedMedia != null) && targetUrl.isNotBlank()
    val canSave = !busy && title.trim().length >= 2 && content.trim().isNotEmpty() &&
        placements.isNotEmpty() && validTarget && validSchedule && keepsActiveBannerValid

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("←  Управление") }
            Text("Баннеры и кампании", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                "Сохраните черновик, добавьте фото или видео и ссылку перед включением.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
        }
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
                ),
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        if (editing == null) "Новый баннер" else "Изменить баннер",
                        fontWeight = FontWeight.SemiBold,
                        color = UtpInk,
                    )
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it.take(160) },
                        label = { Text("Заголовок") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it.take(1000) },
                        label = { Text("Текст баннера") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        maxLines = 5,
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = targetUrl,
                        onValueChange = { targetUrl = it.take(1000) },
                        label = { Text("Ссылка: https://… или app://home") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    if (!validTarget) {
                        Text(
                            "Нужна HTTP(S)-ссылка или раздел приложения.",
                            color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                        )
                    }
                    Text("Размещение", fontWeight = FontWeight.Medium, color = UtpInk)
                    bannerPlacements.chunked(2).forEach { rowItems ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            rowItems.forEach { (key, label) ->
                                FilterChip(
                                    selected = key in placements,
                                    onClick = {
                                        placements = if (key in placements) {
                                            placements - key
                                        } else {
                                            placements + key
                                        }
                                    },
                                    label = { Text(label) },
                                )
                            }
                        }
                    }
                    ScheduleDateTimeField(
                        "Начало показа",
                        startsAt,
                        { startsAt = it },
                    )
                    ScheduleDateTimeField(
                        "Окончание показа",
                        endsAt,
                        { endsAt = it },
                    )
                    if (!validSchedule) {
                        Text(
                            "Дата окончания должна быть позже даты начала.",
                            color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MediaPickerButton(
                            label = when {
                                selectedMedia != null -> "Медиафайл выбран"
                                editing?.imageObjectId != null || editing?.videoObjectId != null -> "Заменить фото или видео"
                                else -> "Выбрать фото или видео"
                            },
                            enabled = !busy,
                        ) { selectedMedia = it }
                        if (selectedMedia != null) {
                            Text(
                                "Фото или видео загрузится при сохранении.",
                                fontSize = 11.sp,
                                color = UtpMuted,
                                modifier = Modifier.padding(top = 12.dp),
                            )
                        }
                    }
                    if (selectedMedia == null) {
                        editing?.videoObjectId?.let { videoId ->
                            RemoteProjectVideo(videoId, token, Modifier.fillMaxWidth().height(160.dp), "Видео баннера")
                        } ?: editing?.imageObjectId?.let { imageId ->
                            RemoteProjectImage(imageId, token, Modifier.fillMaxWidth().height(140.dp), "Изображение баннера")
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                val currentEdit = editing
                                val mediaUri = selectedMedia
                                runAction({
                                    val saved = if (currentEdit == null) {
                                        AdminMarketingApi.createBanner(
                                            token,
                                            title,
                                            content,
                                            targetUrl,
                                            placements.toList(),
                                            startsAt,
                                            endsAt,
                                        )
                                    } else {
                                        AdminMarketingApi.updateBanner(
                                            token,
                                            currentEdit.id,
                                            title,
                                            content,
                                            targetUrl,
                                            placements.toList(),
                                            startsAt,
                                            endsAt,
                                        )
                                    }
                                    val mediaError = mediaUri?.let { uri ->
                                        runCatching {
                                            val media = readSelectedMedia(context, uri)
                                            AdminMarketingApi.uploadBannerMedia(
                                                token,
                                                saved.id,
                                                media.bytes,
                                                media.contentType,
                                            )
                                        }.exceptionOrNull()?.message
                                    }
                                    BannerSaveResult(saved, mediaError)
                                }) { result ->
                                    val saveResult = result as? BannerSaveResult
                                    clearForm()
                                    reload()
                                    saveResult?.mediaError?.let {
                                        onError("Сохранено, но фото или видео не загрузилось: $it")
                                    }
                                }
                            },
                            enabled = canSave,
                            modifier = Modifier.weight(1f),
                        ) {
                            Text(if (editing == null) "Сохранить черновик" else "Сохранить изменения")
                        }
                        if (editing != null) {
                            OutlinedButton(onClick = ::clearForm, enabled = !busy) { Text("Отмена") }
                        }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    "Сохранённые баннеры",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
                TextButton(onClick = ::reload, enabled = !loading && !busy) { Text("Обновить") }
            }
            if (loading) Text("Загрузка…", color = UtpMuted)
            else if (banners.isEmpty()) Text("Баннеров пока нет.", color = UtpMuted)
        }
        items(banners, key = { it.id }) { banner ->
            AdminBannerCard(
                banner = banner,
                token = token,
                busy = busy,
                onMediaSelected = { uri ->
                    runAction({
                        val media = readSelectedMedia(context, uri)
                        AdminMarketingApi.uploadBannerMedia(
                            token,
                            banner.id,
                            media.bytes,
                            media.contentType,
                        )
                    }) { reload() }
                },
                onEdit = { editBanner(banner) },
                onToggle = {
                    val shouldActivate = !banner.isActive
                    if (shouldActivate && !bannerCanBeActivated(banner)) {
                        onError(
                            "Добавьте фото или видео, заголовок, текст и ссылку перед включением.",
                        )
                    } else {
                        confirmation = BannerConfirmation(
                            title = if (shouldActivate) {
                                "Включить баннер?"
                            } else {
                                "Отключить баннер?"
                            },
                            message = if (shouldActivate) {
                                "Баннер станет виден в выбранных разделах."
                            } else {
                                "Баннер перестанет показываться."
                            },
                            action = {
                                AdminMarketingApi.setBannerActive(
                                    token,
                                    banner.id,
                                    shouldActivate,
                                )
                            },
                        )
                    }
                },
                onDelete = {
                    confirmation = BannerConfirmation(
                        title = "Удалить баннер?",
                        message = "Удалятся баннер и фото; действие нельзя отменить.",
                        action = { AdminMarketingApi.deleteBanner(token, banner.id) },
                    )
                },
            )
        }
    }

    confirmation?.let { pending ->
        AlertDialog(
            onDismissRequest = { confirmation = null },
            title = { Text(pending.title) },
            text = { Text(pending.message) },
            confirmButton = {
                TextButton(onClick = {
                    confirmation = null
                    runAction({ pending.action() }) { reload() }
                }, enabled = !busy) { Text("Подтвердить") }
            },
            dismissButton = {
                TextButton(onClick = { confirmation = null }) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun AdminBannerCard(
    banner: SiteBanner,
    token: String,
    busy: Boolean,
    onMediaSelected: (Uri) -> Unit,
    onEdit: () -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text(banner.title, fontWeight = FontWeight.Bold, color = UtpInk, fontSize = 16.sp)
            Text(
                if (banner.isActive) "Включён" else "Черновик",
                color = if (banner.isActive) UtpBlue else UtpMuted,
                fontSize = 12.sp,
            )
            Text(banner.content, color = UtpMuted, fontSize = 13.sp)
            val placementLabels = banner.placements.mapNotNull { code ->
                bannerPlacements.firstOrNull { it.first == code }?.second
            }.joinToString()
            Text("Разделы: $placementLabels", color = UtpMuted, fontSize = 11.sp)
            Text("Ссылка: ${banner.targetUrl ?: "не задана"}", color = UtpMuted, fontSize = 11.sp)
            banner.videoObjectId?.let { videoId ->
                RemoteProjectVideo(videoId, token, Modifier.fillMaxWidth().height(160.dp), "Видео баннера ${banner.title}")
            } ?: banner.imageObjectId?.let { objectId ->
                RemoteProjectImage(objectId, token, Modifier.fillMaxWidth().height(140.dp), "Баннер ${banner.title}")
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                MediaPickerButton(
                    label = if (banner.imageObjectId == null && banner.videoObjectId == null) {
                        "Загрузить фото или видео"
                    } else {
                        "Заменить фото или видео"
                    },
                    enabled = !busy,
                    onMediaSelected = onMediaSelected,
                )
                TextButton(
                    onClick = onEdit,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) { Text("Изменить") }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TextButton(onClick = onToggle, enabled = !busy, modifier = Modifier.weight(1f)) {
                    Text(if (banner.isActive) "Отключить" else "Включить")
                }
                TextButton(
                    onClick = onDelete,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                ) { Text("Удалить") }
            }
        }
    }
}

private fun isAllowedBannerTarget(value: String): Boolean =
    value.startsWith("https://", ignoreCase = true) ||
        value.startsWith("http://", ignoreCase = true) ||
        Regex("(?i)^app://(home|news|services|crafts|about|loyalty|checks)$").matches(value)

private fun bannerCanBeActivated(banner: SiteBanner): Boolean =
    (banner.imageObjectId != null || banner.videoObjectId != null) &&
        banner.title.isNotBlank() && banner.content.isNotBlank() &&
        !banner.targetUrl.isNullOrBlank() && isAllowedBannerTarget(banner.targetUrl)
