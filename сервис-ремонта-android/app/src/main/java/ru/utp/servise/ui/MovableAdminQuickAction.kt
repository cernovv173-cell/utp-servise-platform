package ru.utp.servise.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.AdminQuickActionPosition
import kotlin.math.roundToInt

@Composable
fun MovableAdminQuickAction(
    position: AdminQuickActionPosition,
    onPositionChanged: (AdminQuickActionPosition) -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier) {
        val iconRotation by rememberInfiniteTransition(label = "quickActionSpin")
            .animateFloat(
                initialValue = 0f,
                targetValue = 360f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = 5_000, easing = LinearEasing),
                    repeatMode = RepeatMode.Restart,
                ),
                label = "quickActionIconRotation",
            )
        var buttonSize by remember { mutableStateOf(IntSize.Zero) }
        var dragPosition by remember(position) { mutableStateOf(position) }
        val maxX = (constraints.maxWidth - buttonSize.width).coerceAtLeast(0).toFloat()
        val maxY = (constraints.maxHeight - buttonSize.height).coerceAtLeast(0).toFloat()

        FloatingActionButton(
            onClick = onClick,
            containerColor = UtpBlue,
            contentColor = androidx.compose.ui.graphics.Color.White,
            modifier = Modifier
                .offset {
                    IntOffset(
                        x = (maxX * dragPosition.xFraction).roundToInt(),
                        y = (maxY * dragPosition.yFraction).roundToInt(),
                    )
                }
                .onSizeChanged { buttonSize = it }
                .pointerInput(maxX, maxY, position) {
                    detectDragGesturesAfterLongPress(
                        onDragEnd = { onPositionChanged(dragPosition) },
                        onDragCancel = { dragPosition = position },
                    ) { change, dragAmount ->
                        change.consume()
                        dragPosition = dragPosition.draggedBy(dragAmount.x, dragAmount.y, maxX, maxY)
                    }
                },
        ) {
            Text(
                text = "⏻",
                fontSize = 28.sp,
                modifier = Modifier
                    .rotate(iconRotation)
                    .semantics { contentDescription = "Создать заявку" },
            )
        }
    }
}
