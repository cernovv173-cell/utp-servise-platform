package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.BuildConfig

@Composable
internal fun AppVersionScreen(onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        OutlinedButton(onClick = onBack, shape = RoundedCornerShape(14.dp)) {
            Text("Назад")
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("О версии программы", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text("Информация об установленном приложении", fontSize = 13.sp, color = UtpMuted)
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                VersionValue(label = "Версия приложения", value = BuildConfig.VERSION_NAME.orEmpty())
                Spacer(Modifier.height(16.dp))
                VersionValue(label = "Версия сборки", value = BuildConfig.VERSION_CODE.toString())
            }
        }
        Text("Данные версии указываются автоматически при сборке приложения.", fontSize = 12.sp, color = UtpMuted)
        Text(
            "При открытии приложения проверяется новая версия на сайте. Если она доступна, появится предложение обновиться; установку нужно подтвердить в Android.",
            fontSize = 12.sp,
            color = UtpMuted,
        )
    }
}

@Composable
private fun VersionValue(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 13.sp, color = UtpMuted)
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
    }
}
