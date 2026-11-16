package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CatalogItem

@Composable
internal fun CatalogManagementSection(
    title: String,
    items: List<CatalogItem>,
    expanded: Boolean,
    onToggle: () -> Unit,
    itemContent: @Composable (CatalogItem) -> Unit,
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TextButton(
                onClick = onToggle,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        text = title,
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.SemiBold,
                        color = UtpInk,
                    )
                    Text(
                        text = items.size.toString(),
                        modifier = Modifier
                            .background(
                                color = androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(50),
                            )
                            .padding(horizontal = 9.dp, vertical = 4.dp),
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                    Text(
                        text = if (expanded) "Свернуть" else "Развернуть",
                        fontSize = 12.sp,
                        color = UtpBlue,
                    )
                }
            }
            if (expanded) {
                if (items.isEmpty()) {
                    Text(
                        text = "В этом разделе пока нет позиций.",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (item in items) {
                            itemContent(item)
                        }
                    }
                }
            }
        }
    }
}
