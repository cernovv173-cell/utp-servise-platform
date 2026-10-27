package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.navigation.WorkspaceSectionGroup

@Composable
internal fun WorkspaceSectionsScreen(
    groups: List<WorkspaceSectionGroup>,
    onOpenSection: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(start = 18.dp, top = 20.dp, end = 18.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Разделы", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Дополнительные возможности вашего аккаунта", fontSize = 13.sp, color = UtpMuted)
            }
        }
        groups.forEach { group ->
            item(key = "section-group-${group.title}") {
                WorkspaceSectionGroupContent(group, onOpenSection)
            }
        }
    }
}

@Composable
private fun WorkspaceSectionGroupContent(
    group: WorkspaceSectionGroup,
    onOpenSection: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(group.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
        group.destinations.forEach { destination ->
            Card(
                onClick = { onOpenSection(destination.route) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = null,
                        tint = UtpBlue,
                        modifier = Modifier.padding(end = 12.dp),
                    )
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(destination.label, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(destination.description, fontSize = 12.sp, color = UtpMuted)
                    }
                    Text("›", fontSize = 24.sp, color = UtpMuted)
                }
            }
        }
    }
}
