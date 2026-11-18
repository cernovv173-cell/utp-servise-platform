package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.RepairWorkActCatalogShortcuts
import ru.utp.servise.data.filterRepairWorkActCatalogItems

private val catalogModes = listOf(
    "ALL" to "Весь каталог",
    "FAVORITES" to "Избранное",
    "RECENT" to "Недавние",
)

private val catalogTypes = listOf(
    "ALL" to "Все",
    "SERVICE" to "Работы",
    "SOFTWARE" to "ПО",
    "SPARE_PART" to "Запчасти",
    "PRODUCT" to "Товары",
)

@Composable
internal fun RepairWorkActCatalogPickerDialog(
    items: List<CatalogItem>,
    shortcuts: RepairWorkActCatalogShortcuts,
    onToggleFavorite: (String) -> Unit,
    onAdd: (CatalogItem) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("ALL") }
    var typeFilter by remember { mutableStateOf("ALL") }
    val visibleItems = remember(items, mode, typeFilter, query, shortcuts) {
        filterRepairWorkActCatalogItems(items, mode, typeFilter, query, shortcuts)
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.96f).heightIn(max = 720.dp),
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Добавить позицию в акт", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(
                    "Найдите работу или запчасть. В чек она попадёт только после одобрения администратора.",
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = UtpMuted,
                )
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Поиск по названию или описанию") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    catalogModes.forEach { (value, label) ->
                        FilterChip(
                            selected = mode == value,
                            onClick = { mode = value },
                            label = { Text(label, fontSize = 10.sp) },
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    catalogTypes.forEach { (value, label) ->
                        FilterChip(
                            selected = typeFilter == value,
                            onClick = { typeFilter = value },
                            label = { Text(label, fontSize = 10.sp) },
                        )
                    }
                }

                if (visibleItems.isEmpty()) {
                    Text(
                        when {
                            mode == "FAVORITES" && shortcuts.favoriteIds.isEmpty() ->
                                "Пока нет избранных позиций. Нажмите на звёздочку у нужной работы или запчасти."
                            mode == "RECENT" && shortcuts.recentIds.isEmpty() ->
                                "Недавние позиции появятся здесь после добавления в акт."
                            else -> "По этому запросу ничего не найдено."
                        },
                        modifier = Modifier.fillMaxWidth().background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(12.dp),
                        ).padding(14.dp),
                        color = UtpMuted,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp, max = 340.dp),
                        verticalArrangement = Arrangement.spacedBy(7.dp),
                    ) {
                        items(visibleItems, key = CatalogItem::id) { item ->
                            RepairWorkActCatalogRow(
                                item = item,
                                isFavorite = item.id in shortcuts.favoriteIds,
                                onToggleFavorite = { onToggleFavorite(item.id) },
                                onAdd = { onAdd(item) },
                            )
                        }
                    }
                }

                TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) {
                    Text("Закрыть")
                }
            }
        }
    }
}

@Composable
private fun RepairWorkActCatalogRow(
    item: CatalogItem,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    onAdd: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().background(
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            RoundedCornerShape(12.dp),
        ).padding(start = 11.dp, top = 8.dp, end = 5.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(item.name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                buildString {
                    append(if (item.serviceCategory == "SOFTWARE") "ПО" else catalogItemTypeLabel(item.type))
                    append(" · ${item.unitPriceRub} ₽")
                    item.stockQuantity?.let { append(if (it > 0) " · остаток $it" else " · нет в наличии") }
                },
                fontSize = 10.sp,
                color = UtpMuted,
            )
        }
        IconButton(
            onClick = onToggleFavorite,
            modifier = Modifier.size(40.dp).semantics {
                contentDescription = if (isFavorite) "Убрать из избранного: ${item.name}" else "Добавить в избранное: ${item.name}"
            },
        ) {
            Text(if (isFavorite) "★" else "☆", color = androidx.compose.ui.graphics.Color(0xFFD08A00), fontSize = 20.sp)
        }
        Button(onClick = onAdd, shape = RoundedCornerShape(10.dp)) {
            Text("Добавить", fontSize = 10.sp)
        }
    }
}

private fun catalogItemTypeLabel(type: String): String = when (type) {
    "SERVICE" -> "Работа"
    "SPARE_PART" -> "Запчасть"
    else -> "Товар"
}
