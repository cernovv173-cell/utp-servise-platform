package ru.utp.servise.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private const val CAROUSEL_INTERVAL_MS = 10_000L

@Composable
fun <T> TimedCarousel(
    items: List<T>,
    itemKey: (T) -> Any,
    collectionLabel: String,
    previousActionLabel: String,
    nextActionLabel: String,
    modifier: Modifier = Modifier,
    itemContent: @Composable (T) -> Unit,
) {
    if (items.isEmpty()) return

    val itemKeys = items.map(itemKey)
    var currentIndex by remember(itemKeys) { mutableIntStateOf(0) }
    var transitionDirection by remember { mutableIntStateOf(1) }
    var isPaused by remember { mutableStateOf(false) }
    val activeIndex = currentIndex % items.size
    val currentItem = items[activeIndex]

    LaunchedEffect(itemKeys, currentIndex, isPaused) {
        if (items.size > 1 && !isPaused) {
            delay(CAROUSEL_INTERVAL_MS)
            transitionDirection = 1
            currentIndex = (currentIndex + 1) % items.size
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        AnimatedContent(
            targetState = currentItem,
            transitionSpec = {
                (
                    slideInHorizontally { width -> transitionDirection * width } + fadeIn()
                ).togetherWith(
                    slideOutHorizontally { width -> -transitionDirection * width } + fadeOut(),
                ).using(SizeTransform(clip = true))
            },
            label = collectionLabel,
            modifier = Modifier.fillMaxWidth(),
        ) { item ->
            itemContent(item)
        }

        if (items.size > 1) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${activeIndex + 1} / ${items.size}",
                    color = UtpMuted,
                    fontSize = 11.sp,
                )
                TextButton(
                    onClick = {
                        transitionDirection = -1
                        currentIndex = (activeIndex - 1 + items.size) % items.size
                    },
                    modifier = Modifier.semantics { contentDescription = previousActionLabel },
                ) {
                    Text("‹", fontSize = 22.sp, fontWeight = FontWeight.Medium)
                }
                TextButton(
                    onClick = { isPaused = !isPaused },
                    modifier = Modifier.semantics {
                        contentDescription = if (isPaused) {
                            "Продолжить смену $collectionLabel"
                        } else {
                            "Приостановить смену $collectionLabel"
                        }
                    },
                ) {
                    Text(if (isPaused) "▶" else "Ⅱ", fontSize = 14.sp)
                }
                TextButton(
                    onClick = {
                        transitionDirection = 1
                        currentIndex = (activeIndex + 1) % items.size
                    },
                    modifier = Modifier.semantics { contentDescription = nextActionLabel },
                ) {
                    Text("›", fontSize = 22.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
