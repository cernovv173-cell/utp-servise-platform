package ru.utp.servise.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

@Composable
internal fun CatalogItemDeleteDialog(
    itemName: String,
    requiresZeroStock: Boolean,
    onDismiss: () -> Unit,
    onDelete: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Удалить позицию навсегда?") },
        text = {
            Text(
                "«$itemName» исчезнет из каталога. " +
                    (if (requiresZeroStock) "Сначала установите остаток в 0. " else "") +
                    "Позиция не должна входить в незавершённый ремонт, ожидающую смету или " +
                    "ожидающий/подтверждённый заказ магазина. История закрытых заказов и " +
                    "сохранённые в ней цены останутся.",
            )
        },
        confirmButton = {
            TextButton(onClick = onDelete) {
                Text("Удалить навсегда", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
