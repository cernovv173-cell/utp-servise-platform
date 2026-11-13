package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal data class DashboardAction(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val onClick: () -> Unit,
)

@Composable
internal fun DashboardGreeting(name: String, subtitle: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = name.firstOrNull()?.uppercase() ?: "У",
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(subtitle, fontSize = 12.sp, color = UtpMuted)
            Text(name, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        }
    }
}

@Composable
internal fun DashboardQuickActionsGrid(actions: List<DashboardAction>) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        actions.chunked(2).forEach { rowActions ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                rowActions.forEach { action ->
                    Card(
                        modifier = Modifier.weight(1f).clickable(onClick = action.onClick),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.primaryContainer),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    action.icon,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                    modifier = Modifier.size(19.dp),
                                )
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    action.title,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = UtpInk,
                                    maxLines = 1,
                                )
                                Text(
                                    action.description,
                                    fontSize = 11.sp,
                                    color = UtpMuted,
                                    maxLines = 2,
                                )
                            }
                        }
                    }
                }
                if (rowActions.size == 1) {
                    Box(Modifier.weight(1f))
                }
            }
        }
    }
}
