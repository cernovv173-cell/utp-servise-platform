package ru.utp.servise.ui

import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.TechnicianProfile

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun TechnicianProfileScreen(
    technicianId: String,
    token: String,
    editable: Boolean,
    runAction: RunAction,
    canViewHomeAddress: Boolean,
) {
    var profile by remember(technicianId) { mutableStateOf<TechnicianProfile?>(null) }
    var experience by remember(technicianId) { mutableStateOf("") }
    var fullName by remember(technicianId) { mutableStateOf("") }
    var phoneNumber by remember(technicianId) { mutableStateOf("") }
    var homeAddress by remember(technicianId) { mutableStateOf("") }
    var selectedPhoto by remember(technicianId) { mutableStateOf<android.net.Uri?>(null) }
    LaunchedEffect(technicianId, token) {
        profile = withContext(Dispatchers.IO) { ApiClient.technicianProfile(token, technicianId) }
        experience = profile?.experienceYears?.toString().orEmpty()
        fullName = profile?.displayName.orEmpty()
        homeAddress = profile?.homeAddress.orEmpty()
        phoneNumber = profile?.phoneNumber.orEmpty()
    }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val photoPicker = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.GetContent()) { selectedPhoto = it }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text(profile?.displayName ?: "Анкета мастера", fontSize = 23.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Spacer(Modifier.height(12.dp))
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        UserAvatar(profile?.avatarObjectId, token, Modifier.size(92.dp).clip(RoundedCornerShape(46.dp)), "Фото мастера")
                        if (editable) {
                            OutlinedTextField(fullName, { fullName = it.take(120) }, label = { Text("ФИО") }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), singleLine = true)
                            OutlinedTextField(phoneNumber, { phoneNumber = it.take(32) }, label = { Text("Номер телефона") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), singleLine = true)
                            OutlinedTextField(homeAddress, { homeAddress = it.take(500) }, label = { Text("Домашний адрес (виден только вам и администратору)") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 2)
                            Button(onClick = { photoPicker.launch("image/*") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(if (selectedPhoto == null) "Выбрать фото" else "Фото выбрано") }
                            OutlinedTextField(experience, { experience = it.filter(Char::isDigit).take(2) }, label = { Text("Стаж, лет") }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp), singleLine = true)
                            Button(onClick = {
                                coroutineScope.launch {
                                    runAction({
                                        if (selectedPhoto != null) {
                                            val bytes = context.contentResolver.openInputStream(selectedPhoto!!)?.use { it.readBytes() }
                                            if (bytes != null) ApiClient.updateAvatar(token, bytes)
                                        }
                                        ApiClient.saveTechnicianProfile(token, technicianId, fullName, phoneNumber.ifBlank { null }, experience.toIntOrNull(), homeAddress)
                                    }) { profile = ApiClient.technicianProfile(token, technicianId) }
                                }
                            }, modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) { Text("Сохранить анкету") }
                        } else {
                            Text("Стаж: ${profile?.experienceYears?.let { "$it лет" } ?: "не указан"}", color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                            Text("Телефон: ${profile?.phoneNumber.orEmpty().ifBlank { "не указан" }}", color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                            if (canViewHomeAddress) {
                                Text("Домашний адрес: ${profile?.homeAddress.orEmpty().ifBlank { "не указан" }}", color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                            }
                        }
                    }
                }
    }
}
