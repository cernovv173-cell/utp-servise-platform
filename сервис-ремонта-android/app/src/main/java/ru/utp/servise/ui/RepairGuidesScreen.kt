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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun CustomerGuidesIndexScreen(
    onBack: () -> Unit,
    onOpenGuide: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(start = 18.dp, top = 12.dp, end = 18.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("←  Разделы") }
            Text("Полезные памятки", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                "Короткие советы перед обращением в сервис",
                fontSize = 13.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        items(repairGuides, key = { it.slug }) { guide ->
            Card(
                onClick = { onOpenGuide(guide.slug) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(17.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(guide.title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(guide.summary, fontSize = 12.sp, color = UtpMuted)
                    Text(
                        "Открыть памятку  →",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpBlue,
                    )
                }
            }
        }
    }
}

@Composable
internal fun CustomerGuideArticleScreen(
    slug: String,
    onBack: () -> Unit,
) {
    val guide = repairGuides.firstOrNull { it.slug == slug }
    if (guide == null) {
        Column(Modifier.fillMaxSize().background(UtpPale).padding(18.dp)) {
            TextButton(onClick = onBack) { Text("←  Памятки") }
            Text("Памятка не найдена", color = UtpInk, fontWeight = FontWeight.SemiBold)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Памятки") }
        Text(guide.title, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(guide.summary, fontSize = 13.sp, color = UtpMuted)
        Text(
            guide.listTitle,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = UtpInk,
            modifier = Modifier.padding(top = 4.dp),
        )
        guide.steps.forEachIndexed { index, step ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(15.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Text("${index + 1}.", fontWeight = FontWeight.Bold, color = UtpBlue)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(step.title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(step.description, fontSize = 12.sp, color = UtpMuted)
                    }
                }
            }
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(15.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(guide.noteTitle, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(guide.note, fontSize = 12.sp, color = UtpMuted)
                guide.safetyNote?.let { note ->
                    Text(
                        note,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}
