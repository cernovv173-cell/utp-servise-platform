package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.TechnicianProfile

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun TechnicianProfileScreen(
    technicianId: String,
    token: String,
    editable: Boolean,
    runAction: RunAction,
) {
    var profile by remember(technicianId) { mutableStateOf<TechnicianProfile?>(null) }
    var selectedTab by remember { mutableStateOf(0) }
    var experience by remember(technicianId) { mutableStateOf("") }
    var bio by remember(technicianId) { mutableStateOf("") }
    var certificates by remember(technicianId) { mutableStateOf("") }
    LaunchedEffect(technicianId, token) {
        profile = withContext(Dispatchers.IO) { ApiClient.technicianProfile(token, technicianId) }
        experience = profile?.experienceYears?.toString().orEmpty()
        bio = profile?.bio.orEmpty()
        certificates = profile?.certificates?.joinToString("\n").orEmpty()
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text("${profile?.displayName ?: "Профиль мастера"}${if (profile?.isVerified == true) "  ✓" else ""}", fontSize = 23.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(if (profile?.isVerified == true) "Профиль проверен сервисом" else "Профиль ожидает проверки", color = UtpMuted, fontSize = 13.sp)
        Spacer(Modifier.height(12.dp))
        PrimaryTabRow(selectedTabIndex = selectedTab) {
            listOf("О мастере", "Работы", "Отзывы").forEachIndexed { index, title ->
                Tab(selected = selectedTab == index, onClick = { selectedTab = index }, text = { Text(title) })
            }
        }
        Spacer(Modifier.height(14.dp))
        when (selectedTab) {
            0 -> {
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        RemoteProjectImage(profile?.avatarObjectId, token, Modifier.size(92.dp).clip(RoundedCornerShape(46.dp)), "Фото мастера")
                        Text("★  ${profile?.rating?.let { "%.1f".format(it) } ?: "Пока нет оценок"}", modifier = Modifier.padding(top = 12.dp), color = UtpInk, fontWeight = FontWeight.SemiBold)
                        Text("Выполнено заказов: ${profile?.completedOrders ?: 0}", color = UtpInk, modifier = Modifier.padding(top = 6.dp))
                        if (editable) {
                            OutlinedTextField(experience, { experience = it.filter(Char::isDigit).take(2) }, label = { Text("Стаж, лет") }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), singleLine = true)
                            OutlinedTextField(bio, { bio = it.take(2000) }, label = { Text("О мастере") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 3)
                            OutlinedTextField(certificates, { certificates = it.take(4000) }, label = { Text("Сертификаты — по одному в строке") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 2)
                            Button(onClick = { runAction({ ApiClient.saveTechnicianProfile(token, technicianId, experience.toIntOrNull(), bio, certificates.lines().map(String::trim).filter(String::isNotEmpty).take(20)) }) { profile = it as? TechnicianProfile } }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) { Text("Сохранить профиль") }
                        } else {
                            Text("Стаж: ${profile?.experienceYears?.let { "$it лет" } ?: "не указан"}", color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                            Text(profile?.bio.orEmpty().ifBlank { "Описание пока не добавлено." }, color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                            profile?.certificates.orEmpty().forEach { Text("• $it", color = UtpMuted, modifier = Modifier.padding(top = 5.dp)) }
                        }
                    }
                }
            }
            1 -> {
                if (profile?.works.isNullOrEmpty()) Text("Пока нет работ, опубликованных с согласия клиентов.", color = UtpMuted)
                profile?.works.orEmpty().forEach { work ->
                    Card(Modifier.fillMaxWidth().padding(bottom = 10.dp), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.padding(12.dp)) {
                            RemoteProjectImage(work.objectId, token, Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(12.dp)), "Пример выполненной работы")
                            Text(work.deviceType, color = UtpMuted, modifier = Modifier.padding(top = 7.dp))
                        }
                    }
                }
            }
            else -> {
                Text("Оценка по опубликованным отзывам: ${profile?.rating?.let { "%.1f из 5".format(it) } ?: "пока нет оценок"}", color = UtpInk, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                if (profile?.reviews.isNullOrEmpty()) Text("Опубликованных отзывов пока нет.", color = UtpMuted)
                profile?.reviews.orEmpty().forEach { review ->
                    Card(Modifier.fillMaxWidth().padding(bottom = 8.dp), shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.padding(14.dp)) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(review.customerName.ifBlank { "Клиент" }, fontWeight = FontWeight.SemiBold, color = UtpInk)
                                Text("★ ${review.rating}", color = UtpBlue)
                            }
                            Text(review.deviceType, color = UtpMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                            Text(review.comment, color = UtpInk, modifier = Modifier.padding(top = 7.dp))
                        }
                    }
                }
            }
        }
    }
}
