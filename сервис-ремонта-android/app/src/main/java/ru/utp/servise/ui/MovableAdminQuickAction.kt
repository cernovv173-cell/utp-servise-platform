package ru.utp.servise.ui

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
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
        var buttonSize by remember { mutableStateOf(IntSize.Zero) }
        var dragPosition by remember(position) { mutableStateOf(position) }
        val maxX = (constraints.maxWidth - buttonSize.width).coerceAtLeast(0).toFloat()
        val maxY = (constraints.maxHeight - buttonSize.height).coerceAtLeast(0).toFloat()

        ExtendedFloatingActionButton(
            onClick = onClick,
            icon = { Text("⏻", fontSize = 20.sp) },
            text = {
                Column {
                    Text("СТАРТ / СТОП", fontSize = 10.sp, letterSpacing = 1.sp)
                    Text("Создать заявку")
                }
            },
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
        )
    }
}
