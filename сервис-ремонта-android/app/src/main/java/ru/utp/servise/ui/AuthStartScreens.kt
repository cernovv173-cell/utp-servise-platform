package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal data class LoginPortalOption(
    val portal: String,
    val title: String,
    val description: String,
    val icon: ImageVector,
)

internal val customerLoginPortalOption =
    LoginPortalOption("CUSTOMER", "Я клиент", "Заявки, ремонт и магазин", Icons.Filled.Person)

internal val staffLoginPortalOption = LoginPortalOption(
    "STAFF",
    "Я сотрудник",
    "Войдите с рабочими данными — приложение откроет разделы, доступные вашей учётной записи.",
    Icons.Filled.Settings,
)

internal val loginPortalOptions = listOf(
    customerLoginPortalOption,
    staffLoginPortalOption,
)

@Composable
internal fun WelcomeStartScreen(
    onContinue: () -> Unit,
    onExploreServices: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color.Transparent)
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            BrandLogo(Modifier.size(42.dp))
            Column(Modifier.padding(start = 11.dp)) {
                Text("ЕНОТ СЕРВИС", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("Сервис ремонта техники", fontSize = 12.sp, color = UtpMuted)
            }
        }

        Spacer(Modifier.weight(1f))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(30.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                BrandLogo(Modifier.size(104.dp))
                Text(
                    "Ваша техника снова в порядке",
                    modifier = Modifier.fillMaxWidth(),
                    fontSize = 25.sp,
                    lineHeight = 31.sp,
                    fontWeight = FontWeight.Bold,
                    color = UtpInk,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "Оставляйте заявку, следите за ремонтом и оставайтесь на связи с мастером — всё в одном месте.",
                    modifier = Modifier.fillMaxWidth(),
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                    color = UtpMuted,
                    textAlign = TextAlign.Center,
                )
            }
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = onContinue,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(17.dp),
        ) {
            Text("Начать", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
        TextButton(onClick = onExploreServices, modifier = Modifier.fillMaxWidth()) {
            Text("Сначала посмотреть услуги и контакты")
        }
    }
}

@Composable
internal fun LoginRoleSelectionScreen(
    onBack: () -> Unit,
    onContinue: (String) -> Unit,
    onRegisterCustomer: () -> Unit,
    onExploreServices: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color.Transparent)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Кто вы?", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "Выберите тип аккаунта. Раздел сотрудника откроется по вашей учётной записи.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = UtpMuted,
            modifier = Modifier.padding(top = 5.dp, bottom = 16.dp),
        )

        loginPortalOptions.forEach { option ->
            Card(
                onClick = { onContinue(option.portal) },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
                ),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(14.dp),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            option.icon,
                            contentDescription = null,
                            tint = UtpBlue,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                    Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(
                            option.title,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = UtpInk,
                        )
                        Text(
                            option.description,
                            fontSize = 12.sp,
                            color = UtpMuted,
                            lineHeight = 17.sp,
                        )
                    }
                }
            }
        }
        TextButton(onClick = onRegisterCustomer, modifier = Modifier.fillMaxWidth()) {
            Text("Новый клиент? Зарегистрироваться")
        }
        TextButton(onClick = onExploreServices, modifier = Modifier.fillMaxWidth()) {
            Text("Посмотреть услуги и контакты")
        }
    }
}
