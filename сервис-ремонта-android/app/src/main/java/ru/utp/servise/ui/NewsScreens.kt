package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.NewsArticle
import java.time.Instant

private data class ManagementAction(
    val title: String,
    val description: String,
    val icon: String,
    val onClick: () -> Unit,
)

private data class ManagementActionGroup(
    val title: String,
    val actions: List<ManagementAction>,
)

@Composable
fun AdminManagementScreen(
    onOverview: () -> Unit,
    onSchedule: () -> Unit,
    onProcurement: () -> Unit,
    onNews: () -> Unit,
    onCatalog: () -> Unit,
    onChats: () -> Unit,
    onStaff: () -> Unit,
    onReviews: () -> Unit,
    onCrafts: () -> Unit,
    onAbout: () -> Unit,
    onSupportChats: () -> Unit,
    onCustomers: () -> Unit,
    onShopOrders: () -> Unit,
    onSalary: () -> Unit,
) {
    val groups = listOf(
        ManagementActionGroup(
            "Работа сервиса",
            listOf(
                ManagementAction(
                    "Обзор сервиса",
                    "Просрочки, выручка и популярные работы",
                    "▦",
                    onOverview,
                ),
                ManagementAction(
                    "Расписание мастеров",
                    "Заявки по удобному времени и загрузка",
                    "◷",
                    onSchedule,
                ),
                ManagementAction(
                    "Закупка запчастей",
                    "Пороговые остатки и детали в ремонте",
                    "▣",
                    onProcurement,
                ),
                ManagementAction(
                    "Подтверждение заказов магазина",
                    "Проверка наличия и дальнейшая выдача",
                    "🛍",
                    onShopOrders,
                ),
            ),
        ),
        ManagementActionGroup(
            "Каталог и публикации",
            listOf(
                ManagementAction("Новости", "Создание черновиков и публикаций", "▤", onNews),
                ManagementAction(
                    "Каталог услуг и запчастей",
                    "Позиции прайса и цены",
                    "▧",
                    onCatalog,
                ),
                ManagementAction("Рукоделия", "Изделия, цены, фото и заявки", "✿", onCrafts),
                ManagementAction(
                    "О компании",
                    "Описание, контакты, услуги и медиа",
                    "ℹ",
                    onAbout,
                ),
                ManagementAction("Отзывы", "Отзывы клиентов о ремонтах", "★", onReviews),
            ),
        ),
        ManagementActionGroup(
            "Люди и выплаты",
            listOf(
                ManagementAction(
                    "Чаты с запросом помощи",
                    "Подключение администратора к беседе",
                    "✉",
                    onChats,
                ),
                ManagementAction("Чаты клиентов", "Ответы клиентам напрямую", "✉", onSupportChats),
                ManagementAction("База клиентов", "Поиск, контакты и удаление записей", "♙", onCustomers),
                ManagementAction("Сотрудники", "Мастера и административные аккаунты", "♙", onStaff),
                ManagementAction("Зарплата мастеров", "Начисления и индивидуальные ставки", "₽", onSalary),
            ),
        ),
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Управление сервисом", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Разделы сгруппированы по задачам", fontSize = 13.sp, color = UtpMuted)
            }
        }
        groups.forEach { group ->
            item(key = "management-heading-${group.title}") {
                Text(
                    group.title,
                    modifier = Modifier.padding(top = 8.dp),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
            }
            items(group.actions, key = { it.title }) { action ->
                ManagementCard(action.title, action.description, action.icon, action.onClick)
            }
        }
    }
}

@Composable
private fun ManagementCard(title: String, description: String, icon: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(icon, fontSize = 23.sp, color = UtpBlue, modifier = Modifier.padding(end = 12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(description, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
            }
            Text("›", fontSize = 24.sp, color = UtpMuted)
        }
    }
}

@Composable
fun NewsManagementScreen(
    token: String,
    articles: List<NewsArticle>,
    runAction: RunAction,
    refresh: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var startsAt by remember { mutableStateOf<String?>(null) }
    var endsAt by remember { mutableStateOf<String?>(null) }
    var isFeatured by remember { mutableStateOf(false) }
    var editedArticle by remember { mutableStateOf<NewsArticle?>(null) }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление") }
        Text("Новости", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Черновики видны только администраторам. Публикации появляются на главной у клиентов.", fontSize = 12.sp, color = UtpMuted)
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Новая новость", fontWeight = FontWeight.SemiBold, color = UtpInk)
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
                    onValueChange = { content = it.take(8000) },
                    label = { Text("Текст новости") },
                    modifier = Modifier.fillMaxWidth().height(135.dp),
                    shape = RoundedCornerShape(12.dp),
                )
                ScheduleDateTimeField("Начало публикации", startsAt, { startsAt = it })
                ScheduleDateTimeField("Окончание публикации", endsAt, { endsAt = it })
                OutlinedButton(onClick = { isFeatured = !isFeatured }) {
                    Text(if (isFeatured) "★ Приоритет на главной" else "☆ Без приоритета")
                }
                val valid = title.trim().length >= 3 && content.trim().length >= 5
                val validSchedule = startsAt == null || endsAt == null || runCatching {
                    Instant.parse(startsAt) < Instant.parse(endsAt)
                }.getOrDefault(false)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            runAction({ ApiClient.createNews(token, title.trim(), content.trim(), false, startsAt, endsAt, isFeatured) }) {
                                title = ""
                                content = ""
                                startsAt = null
                                endsAt = null
                                isFeatured = false
                                refresh()
                            }
                        },
                        enabled = valid && validSchedule,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) { Text("Черновик") }
                    Button(
                        onClick = {
                            runAction({ ApiClient.createNews(token, title.trim(), content.trim(), true, startsAt, endsAt, isFeatured) }) {
                                title = ""
                                content = ""
                                startsAt = null
                                endsAt = null
                                isFeatured = false
                                refresh()
                            }
                        },
                        enabled = valid && validSchedule,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) { Text("Опубликовать") }
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Все новости", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.weight(1f))
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        if (articles.isEmpty()) Text("Новостей пока нет.", color = UtpMuted)
        articles.forEach { article ->
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    article.imageObjectId?.let { imageId ->
                        RemoteProjectImage(
                            imageId,
                            token,
                            Modifier.fillMaxWidth().height(170.dp),
                            "Фотография к новости ${article.title}",
                        )
                    }
                    Text(article.title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(article.content, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp))
                    Text(if (article.isPublished) "Опубликована" else "Черновик", fontSize = 11.sp, color = UtpBlue, modifier = Modifier.padding(top = 7.dp))
                    Text(
                        buildString {
                            append(formatNewsScheduleDate("С", article.startsAt))
                            append(" · ")
                            append(formatNewsScheduleDate("До", article.endsAt))
                            if (article.isFeatured) append(" · Приоритет на главной")
                        },
                        fontSize = 11.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { editedArticle = article }) { Text("Изменить") }
                        TextButton(
                            onClick = { runAction({ ApiClient.updateNews(token, article.copy(isPublished = !article.isPublished)) }) {} },
                        ) { Text(if (article.isPublished) "Снять" else "Опубликовать") }
                    }
                    PhotoPickerButton(
                        label = if (article.imageObjectId == null) "Добавить фото" else "Заменить фото",
                    ) { uri ->
                        runAction({
                            ApiClient.uploadNewsImage(
                                token,
                                article.id,
                                compressSelectedImage(context, uri),
                            )
                        }) {}
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }

    editedArticle?.let { article ->
        NewsEditDialog(
            article = article,
            onDismiss = { editedArticle = null },
            onSave = { updated -> runAction({ ApiClient.updateNews(token, updated) }) { editedArticle = null } },
        )
    }
}

@Composable
private fun NewsEditDialog(
    article: NewsArticle,
    onDismiss: () -> Unit,
    onSave: (NewsArticle) -> Unit,
) {
    var title by remember(article.id) { mutableStateOf(article.title) }
    var content by remember(article.id) { mutableStateOf(article.content) }
    var startsAt by remember(article.id) { mutableStateOf(article.startsAt) }
    var endsAt by remember(article.id) { mutableStateOf(article.endsAt) }
    var isFeatured by remember(article.id) { mutableStateOf(article.isFeatured) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Изменить новость") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { title = it.take(160) }, label = { Text("Заголовок") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                OutlinedTextField(content, { content = it.take(8000) }, label = { Text("Текст") }, modifier = Modifier.fillMaxWidth().height(140.dp), shape = RoundedCornerShape(12.dp))
                ScheduleDateTimeField("Начало публикации", startsAt, { startsAt = it })
                ScheduleDateTimeField("Окончание публикации", endsAt, { endsAt = it })
                OutlinedButton(onClick = { isFeatured = !isFeatured }) {
                    Text(if (isFeatured) "★ Приоритет на главной" else "☆ Без приоритета")
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(article.copy(title = title.trim(), content = content.trim(), startsAt = startsAt, endsAt = endsAt, isFeatured = isFeatured)) },
                enabled = title.trim().length >= 3 && content.trim().length >= 5 && (startsAt == null || endsAt == null || runCatching { Instant.parse(startsAt) < Instant.parse(endsAt) }.getOrDefault(false)),
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
