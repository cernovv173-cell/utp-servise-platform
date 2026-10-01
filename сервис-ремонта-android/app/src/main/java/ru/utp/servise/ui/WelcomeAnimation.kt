package ru.utp.servise.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
fun WelcomeAnimation(onFinished: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    var signVisible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
        delay(700)
        signVisible = true
        delay(1_250)
        visible = false
        delay(350)
        onFinished()
    }

    Dialog(
        onDismissRequest = onFinished,
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
                onClick = onFinished,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp),
            ) {
                Text("Пропустить")
            }
            AnimatedVisibility(
                visible = visible,
                enter = fadeIn(tween(500, easing = FastOutSlowInEasing)) +
                    scaleIn(initialScale = 0.78f, animationSpec = tween(600, easing = FastOutSlowInEasing)),
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
                                .heightIn(max = 560.dp),
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
                                    "Привет!",
                                    modifier = Modifier.padding(horizontal = 28.dp, vertical = 14.dp),
                                    style = MaterialTheme.typography.headlineMedium,
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
