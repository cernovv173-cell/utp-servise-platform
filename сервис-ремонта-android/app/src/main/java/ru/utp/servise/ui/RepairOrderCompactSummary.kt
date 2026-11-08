package ru.utp.servise.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.statusLabel

@Composable
internal fun RepairOrderCompactSummary(
    order: RepairOrder,
    role: String,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                order.serviceNumber,
                fontSize = 11.sp,
                color = UtpBlue,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            if (order.archivedAt != null) {
                Text(
                    "В АРХИВЕ",
                    fontSize = 10.sp,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.tertiary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
            OrderStatusPill(order.status.statusLabel())
        }
        val deviceDescription = listOfNotNull(
            order.deviceBrand?.takeIf { it.isNotBlank() },
            order.deviceModel?.takeIf { it.isNotBlank() },
        ).joinToString(" · ")
        val title = buildList {
            if (role != "CUSTOMER" && order.customerName.isNotBlank()) add(order.customerName)
            add(order.deviceType.deviceLabel())
            if (deviceDescription.isNotBlank()) add(deviceDescription)
        }.joinToString(" · ")
        Text(
            title,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            color = UtpInk,
            modifier = Modifier.padding(top = 5.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            order.problem,
            fontSize = 12.sp,
            color = UtpMuted,
            modifier = Modifier.padding(top = 3.dp),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        TextButton(
            onClick = onToggle,
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
        ) {
            Text(if (expanded) "Свернуть заявку" else "Открыть подробности заявки")
        }
    }
}
