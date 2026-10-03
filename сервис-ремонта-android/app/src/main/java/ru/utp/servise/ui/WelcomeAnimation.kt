package ru.utp.servise.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
    var visible by remember { mutableStateOf(false) }
    var signVisible by remember { mutableStateOf(false) }
    val mascotRotation = remember(mode) { Animatable(if (isDynamic) -9f else 0f) }
    var finished by remember { mutableStateOf(false) }

    val finish = {
        if (!finished) {
            finished = true
            onFinished()
        }
    }

    LaunchedEffect(mode) {
        visible = true
        if (isDynamic) {
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
            delay(180)
        } else {
            delay(420)
        }
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
            modifier = Modifier
                .fillMaxSize()
                .background(UtpPale)
                .padding(WindowInsets.safeDrawing.asPaddingValues()),
            contentAlignment = Alignment.Center,
        ) {
            Button(
                onClick = finish,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp),
            ) {
                Text("Пропустить")
            }
            AnimatedVisibility(
                visible = visible,
                enter = if (isDynamic) {
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
                } else {
                    fadeIn(tween(650, easing = FastOutSlowInEasing)) +
                        scaleIn(
                            initialScale = 0.96f,
                            animationSpec = tween(650, easing = FastOutSlowInEasing),
                        )
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
                                    rotationZ = if (isDynamic) mascotRotation.value else 0f
                                },
                            contentScale = ContentScale.Fit,
                        )
                        androidx.compose.animation.AnimatedVisibility(
                            visible = signVisible,
                            modifier = Modifier.align(Alignment.Center),
                            enter = fadeIn(tween(300)) + scaleIn(initialScale = 0.7f, animationSpec = tween(350)),
                        ) {
                            Surface(
                                color = MaterialTheme.colorScheme.primary,
                                contentColor = Color.White,
                                shadowElevation = 12.dp,
                                shape = MaterialTheme.shapes.large,
                                modifier = Modifier.graphicsLayer { translationY = 48f },
                            ) {
                                Text(
                                    if (isDynamic) "Ремонт техники — просто" else "Добро пожаловать!",
                                    modifier = Modifier.padding(horizontal = 28.dp, vertical = 14.dp),
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
}
