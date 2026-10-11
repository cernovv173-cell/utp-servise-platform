package ru.utp.servise.ui

import android.media.MediaPlayer
import android.net.Uri
import android.view.View
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import ru.utp.servise.R

@Composable
fun WelcomeVideoIntro(
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val currentOnContinue by rememberUpdatedState(onContinue)
    val videoView = remember { mutableStateOf<VideoView?>(null) }
    val mediaPlayer = remember { mutableStateOf<MediaPlayer?>(null) }
    var videoReady by remember { mutableStateOf(false) }
    var videoFailed by remember { mutableStateOf(false) }
    var muted by remember { mutableStateOf(true) }

    DisposableEffect(Unit) {
        onDispose {
            videoView.value?.stopPlayback()
            mediaPlayer.value = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF070D20), Color(0xFF101C3A), Color(0xFF171333)),
                ),
            ),
    ) {
        if (!videoFailed) {
            AndroidView(
                factory = { viewContext ->
                    VideoView(viewContext).apply {
                        videoView.value = this
                        visibility = View.INVISIBLE
                        setOnPreparedListener { player ->
                            mediaPlayer.value = player
                            player.isLooping = false
                            player.setVolume(0f, 0f)
                            visibility = View.VISIBLE
                            start()
                            videoReady = true
                        }
                        setOnCompletionListener { currentOnContinue() }
                        setOnErrorListener { _, _, _ ->
                            videoReady = false
                            videoFailed = true
                            true
                        }
                        setVideoURI(
                            Uri.parse("android.resource://${context.packageName}/${R.raw.welcome_intro}"),
                        )
                    }
                },
                modifier = Modifier.fillMaxSize(),
                update = {},
            )
        }

        if (!videoReady || videoFailed) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = 28.dp, vertical = 36.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    text = "UTP SERVISE",
                    color = Color(0xFF9EEBFF),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                )
                Text(
                    text = "Привет! Я ваш енот-сервис!",
                    color = Color.White,
                    fontSize = 27.sp,
                    lineHeight = 33.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "Махаю вам в знак дружбы!",
                    color = Color(0xFFCCD8F4),
                    fontSize = 16.sp,
                )
                if (videoFailed) {
                    Text(
                        text = "Видео не запустилось. Можно продолжить без него.",
                        color = Color(0xFFFFD699),
                        fontSize = 14.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(
                            onClick = {
                                videoFailed = false
                                videoReady = false
                                muted = true
                            },
                        ) {
                            Text("Повторить видео")
                        }
                        Button(onClick = currentOnContinue) {
                            Text("Продолжить")
                        }
                    }
                } else {
                    CircularProgressIndicator(
                        modifier = Modifier.size(28.dp),
                        color = Color(0xFF74DFFF),
                        strokeWidth = 3.dp,
                    )
                    Text("Подготавливаем приветствие…", color = Color(0xFFCCD8F4), fontSize = 14.sp)
                    OutlinedButton(onClick = currentOnContinue) {
                        Text("Пропустить")
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "UTP Servise",
                    modifier = Modifier
                        .background(Color(0x99070D20), RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xB3070D20), RoundedCornerShape(22.dp))
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "Привет! Я ваш енот-сервис! Махаю вам в знак дружбы!",
                        color = Color.White,
                        fontWeight = FontWeight.Medium,
                        fontSize = 16.sp,
                        lineHeight = 23.sp,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedButton(
                            onClick = {
                                muted = !muted
                                mediaPlayer.value?.setVolume(if (muted) 0f else 1f, if (muted) 0f else 1f)
                            },
                        ) {
                            Text(if (muted) "Включить звук" else "Выключить звук")
                        }
                        Button(onClick = currentOnContinue) {
                            Text("Пропустить")
                        }
                    }
                }
            }
        }
    }
}
