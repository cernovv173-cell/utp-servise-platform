package ru.utp.servise.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.delay
import ru.utp.servise.R

private const val GUIDE_PREFERENCES = "raccoon-guide"
private const val GUIDE_ENABLED = "enabled"

internal data class RaccoonGuideHint(
    val title: String,
    val message: String,
)

internal fun getRaccoonGuideHint(route: String?, role: String): RaccoonGuideHint {
    val active = route.orEmpty()
    return when {
        active == "customer/home" -> RaccoonGuideHint(
            "Я рядом",
            if (role == "ADMIN") "Здесь можно быстро перейти к заказам и управлению сервисом."
            else "Нужен ремонт? Откройте раздел «Заявки» — я подскажу по ходу оформления.",
        )
        active == "customer/orders" || active == "admin/orders" -> RaccoonGuideHint(
            "Подсказка по заявкам",
            if (role == "ADMIN") "Откройте карточку заказа, чтобы изменить статус, мастера или срок ремонта."
            else "Нажмите «Создать заявку», опишите неисправность и прикрепите фото, если это поможет мастеру.",
        )
        active == "customer/devices" -> RaccoonGuideHint(
            "Ваша техника",
            "Сохраните компьютер или ноутбук один раз — повторную заявку потом оформить быстрее.",
        )
        active.contains("support-chat") -> RaccoonGuideHint(
            "Нужна помощь?",
            "В чате поддержки можно задать вопрос сервису и вернуться к нему позже.",
        )
        active.contains("game") -> RaccoonGuideHint(
            "Подсказка игры",
            "Подсказка следующего хода не расходует ход — используйте её, если поле застопорилось.",
        )
        active == "customer/loyalty" -> RaccoonGuideHint(
            "Бонусные баллы",
            "Здесь виден баланс и правила его использования — баллы дают скидку, но не являются деньгами.",
        )
        else -> RaccoonGuideHint(
            "Я помогу сориентироваться",
            "Используйте нижнее меню, чтобы открыть нужный раздел. Помощника можно выключить здесь.",
        )
    }
}

@Composable
internal fun RaccoonGuide(
    route: String?,
    role: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val preferences = remember { context.getSharedPreferences(GUIDE_PREFERENCES, 0) }
    var enabled by remember { mutableStateOf(preferences.getBoolean(GUIDE_ENABLED, true)) }
    var expanded by rememberSaveable { mutableStateOf(true) }
    var pose by remember { mutableIntStateOf(1) }
    val hint = remember(route, role) { getRaccoonGuideHint(route, role) }
    val floatingTransition = rememberInfiniteTransition(label = "raccoon-guide-float")
    val floatingOffset by floatingTransition.animateFloat(
        initialValue = 0f,
        targetValue = -5f,
        animationSpec = infiniteRepeatable(tween(2_300), RepeatMode.Reverse),
        label = "raccoon-guide-offset",
    )

    LaunchedEffect(enabled) {
        if (!enabled) return@LaunchedEffect
        while (true) {
            delay(2_600)
            pose = (pose + 1) % 3
        }
    }

    fun updateEnabled(value: Boolean) {
        enabled = value
        preferences.edit().putBoolean(GUIDE_ENABLED, value).apply()
    }

    if (!enabled) {
        SmallFloatingActionButton(
            onClick = { updateEnabled(true) },
            modifier = modifier,
            shape = RoundedCornerShape(18.dp),
        ) {
            Text("🦝", fontSize = 20.sp)
        }
        return
    }

    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier.widthIn(max = 320.dp),
    ) {
        if (expanded) {
            Card(
                colors = CardDefaults.cardColors(containerColor = UtpPale),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                shape = RoundedCornerShape(22.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Енот-помощник", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
                    Text(hint.title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                    Spacer(Modifier.height(4.dp))
                    Text(hint.message, fontSize = 13.sp, lineHeight = 18.sp, color = UtpMuted)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.End,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        TextButton(onClick = { expanded = false }) { Text("Свернуть") }
                        TextButton(onClick = { updateEnabled(false) }) { Text("Выключить") }
                    }
                }
            }
        }

        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .width(if (expanded) 92.dp else 70.dp)
                .height(if (expanded) 178.dp else 118.dp)
                .clip(RoundedCornerShape(28.dp))
                .background(UtpPale)
                .clickable { expanded = !expanded },
        ) {
            Image(
                painter = painterResource(R.drawable.raccoon_helper_sprite),
                contentDescription = "Анимированный енот-помощник",
                modifier = Modifier
                    .width(if (expanded) 276.dp else 210.dp)
                    .height(if (expanded) 178.dp else 118.dp)
                    .offset(x = (-(pose * if (expanded) 92 else 70)).dp)
                    .graphicsLayer { translationY = floatingOffset },
            )
        }
    }
}
