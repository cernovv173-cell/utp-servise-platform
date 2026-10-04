package ru.utp.servise.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay
import ru.utp.servise.R

@Composable
fun WelcomeAnimation(
    mode: WelcomeAnimationMode,
    onFinished: () -> Unit,
) {
    val isDynamic = mode == WelcomeAnimationMode.BOUNCE
    val hasMascotRotation =
        mode == WelcomeAnimationMode.BOUNCE || mode == WelcomeAnimationMode.TURN
    var visible by remember { mutableStateOf(false) }
    var signVisible by remember { mutableStateOf(false) }
    val mascotRotation = remember(mode) {
        Animatable(
            when (mode) {
                WelcomeAnimationMode.BOUNCE -> -9f
                WelcomeAnimationMode.TURN -> -75f
                else -> 0f
            },
        )
    }
    val ambience = rememberInfiniteTransition(label = "welcome-ambience")
    val orbitRotation by ambience.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(8_000, easing = LinearEasing)),
        label = "welcome-orbit",
    )
    val haloScale by ambience.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(
            tween(1_700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "welcome-halo",
    )
    var finished by remember { mutableStateOf(false) }

    val finish = {
        if (!finished) {
            finished = true
            onFinished()
        }
    }

    LaunchedEffect(mode) {
        visible = true
        when (mode) {
            WelcomeAnimationMode.BOUNCE -> {
                mascotRotation.animateTo(
                    targetValue = 5f,
                    animationSpec = spring(
                        dampingRatio = 0.48f,
                        stiffness = Spring.StiffnessLow,
                    ),
                )
                mascotRotation.animateTo(
                    targetValue = -2f,
                    animationSpec = spring(dampingRatio = 0.55f),
                )
                mascotRotation.animateTo(
                    targetValue = 0f,
                    animationSpec = spring(dampingRatio = 0.62f),
                )
            }
            WelcomeAnimationMode.TURN -> mascotRotation.animateTo(
                targetValue = 0f,
                animationSpec = spring(
                    dampingRatio = 0.78f,
                    stiffness = Spring.StiffnessLow,
                ),
            )
            else -> delay(420)
        }
        if (isDynamic || mode == WelcomeAnimationMode.TURN) delay(180)
        signVisible = true
        delay(if (isDynamic) 1_350 else 850)
        visible = false
        delay(350)
        finish()
    }

    Dialog(
        onDismissRequest = finish,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
        ) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color(0xFF080C1D)),
        ) {
            Image(
                painter = painterResource(R.drawable.repair_nebula_bg),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = 0.82f,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        listOf(Color(0xC9080C1D), Color(0x660A1230), Color(0xE6080C1D)),
                    ),
                ),
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(WindowInsets.safeDrawing.asPaddingValues()),
            ) {
                OutlinedButton(
                    onClick = finish,
                    border = BorderStroke(1.dp, Color(0xFF83E8FF).copy(alpha = 0.7f)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFFBCEEFF),
                        containerColor = Color(0xAA101A35),
                    ),
                    modifier = Modifier.align(Alignment.TopEnd).padding(16.dp),
                ) {
                    Text("Пропустить")
                }
                Column(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "UTP SERVISE  ·  СИСТЕМА ЗАПУСКА",
                        color = Color(0xFF9AEAFF),
                        style = MaterialTheme.typography.labelLarge,
                        letterSpacing = 2.sp,
                    )
                    Box(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            Modifier.size(270.dp)
                                .graphicsLayer { scaleX = haloScale; scaleY = haloScale }
                                .background(
                                    Brush.radialGradient(
                                        listOf(Color(0x664D73FF), Color(0x337A4DFF), Color.Transparent),
                                    ),
                                    shape = androidx.compose.foundation.shape.CircleShape,
                                ),
                        )
                        Canvas(
                            Modifier.size(360.dp)
                                .graphicsLayer { rotationZ = orbitRotation },
                        ) {
                            val inset = size.minDimension * 0.08f
                            val diameter = size.minDimension - inset * 2
                            drawCircle(
                                color = Color(0xFF7BE8FF).copy(alpha = 0.28f),
                                radius = size.minDimension * 0.47f,
                                style = Stroke(width = 1.dp.toPx()),
                            )
                            drawArc(
                                color = Color(0xFF91EDFF).copy(alpha = 0.9f),
                                startAngle = -55f,
                                sweepAngle = 82f,
                                useCenter = false,
                                topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                                size = androidx.compose.ui.geometry.Size(diameter, diameter),
                                style = Stroke(width = 3.dp.toPx()),
                            )
                            drawArc(
                                color = Color(0xFFB998FF).copy(alpha = 0.8f),
                                startAngle = 145f,
                                sweepAngle = 64f,
                                useCenter = false,
                                topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                                size = androidx.compose.ui.geometry.Size(diameter, diameter),
                                style = Stroke(width = 2.dp.toPx()),
                            )
                        }
                        androidx.compose.animation.AnimatedVisibility(
                            visible = visible,
                            enter = when (mode) {
                                WelcomeAnimationMode.BOUNCE ->
                                    fadeIn(tween(500, easing = FastOutSlowInEasing)) +
                                    slideInVertically(
                                        initialOffsetY = { it / 5 },
                                        animationSpec = spring(
                                            dampingRatio = 0.72f,
                                            stiffness = Spring.StiffnessLow,
                                        ),
                                    ) + scaleIn(
                                        initialScale = 0.82f,
                                        animationSpec = spring(
                                            dampingRatio = 0.68f,
                                            stiffness = Spring.StiffnessLow,
                                        ),
                                    )
                                WelcomeAnimationMode.FADE ->
                                    fadeIn(tween(650, easing = FastOutSlowInEasing)) +
                                        scaleIn(
                                            initialScale = 0.96f,
                                            animationSpec = tween(650, easing = FastOutSlowInEasing),
                                        )
                                WelcomeAnimationMode.SLIDE_UP ->
                                    fadeIn(tween(500, easing = FastOutSlowInEasing)) +
                                        slideInVertically(
                                            initialOffsetY = { it / 2 },
                                            animationSpec = tween(
                                                durationMillis = 750,
                                                easing = FastOutSlowInEasing,
                                            ),
                                        )
                                WelcomeAnimationMode.ZOOM ->
                                    fadeIn(tween(550, easing = FastOutSlowInEasing)) +
                                        scaleIn(
                                            initialScale = 0.45f,
                                            animationSpec = spring(
                                                dampingRatio = 0.72f,
                                                stiffness = Spring.StiffnessLow,
                                            ),
                                        )
                                WelcomeAnimationMode.TURN ->
                                    fadeIn(tween(650, easing = FastOutSlowInEasing)) +
                                        scaleIn(
                                            initialScale = 0.9f,
                                            animationSpec = tween(650, easing = FastOutSlowInEasing),
                                        )
                                WelcomeAnimationMode.OFF -> fadeIn(tween(1))
                            },
                            exit = fadeOut(tween(350, easing = FastOutSlowInEasing)),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 18.dp)
                                    .sizeIn(maxWidth = 440.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Image(
                                        painter = painterResource(R.drawable.raccoon_welcome),
                                        contentDescription = "Енот UTP Servise приветствует вас",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(max = 560.dp)
                                            .graphicsLayer {
                                                rotationZ =
                                                    if (hasMascotRotation) mascotRotation.value else 0f
                                            },
                                        contentScale = ContentScale.Fit,
                                    )
                                    androidx.compose.animation.AnimatedVisibility(
                                        visible = signVisible,
                                        modifier = Modifier.align(Alignment.Center),
                                        enter = fadeIn(tween(300)) + scaleIn(
                                            initialScale = 0.7f,
                                            animationSpec = tween(350),
                                        ),
                                    ) {
                                        Surface(
                                            color = Color(0xE6111B39),
                                            contentColor = Color(0xFFEAF8FF),
                                            shadowElevation = 22.dp,
                                            shape = MaterialTheme.shapes.large,
                                            border = BorderStroke(
                                                1.dp,
                                                Color(0xFF8DEBFF).copy(alpha = 0.85f),
                                            ),
                                            modifier = Modifier
                                                .graphicsLayer { translationY = 48f }
                                                .shadow(
                                                    elevation = 18.dp,
                                                    shape = MaterialTheme.shapes.large,
                                                    ambientColor = Color(0xFF587AFF),
                                                    spotColor = Color(0xFF587AFF),
                                                ),
                                        ) {
                                            Column(
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                modifier = Modifier.padding(horizontal = 26.dp, vertical = 12.dp),
                                            ) {
                                                Text(
                                                    "СЕРВИС АКТИВИРОВАН",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = Color(0xFF88E8FF),
                                                    letterSpacing = 1.4.sp,
                                                )
                                                Text(
                                                    if (isDynamic) "Ремонт техники — просто" else "Добро пожаловать!",
                                                    style = MaterialTheme.typography.titleLarge,
                                                    fontWeight = FontWeight.Bold,
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Text(
                        "ТЕХНОЛОГИИ С ЗАБОТОЙ",
                        color = Color(0xFFB9C7EC).copy(alpha = 0.82f),
                        style = MaterialTheme.typography.labelSmall,
                        letterSpacing = 2.sp,
                    )
                }
            }
        }
    }
}
