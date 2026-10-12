package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

@Composable
fun WelcomeGifIntro(
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val currentOnContinue = rememberUpdatedState(onContinue)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF070D20), Color(0xFF101C3A), Color(0xFF171333)),
                ),
            ),
    ) {
        AndroidView(
            factory = ::createWelcomeGifView,
            modifier = Modifier.fillMaxSize(),
        )
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
                    .align(Alignment.End)
                    .background(Color(0xD9070D20), RoundedCornerShape(22.dp))
                    .padding(18.dp),
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = "Привет! Я ваш енот-сервис! Махаю вам в знак дружбы!",
                    color = Color.White,
                    fontWeight = FontWeight.Medium,
                    fontSize = 16.sp,
                    lineHeight = 23.sp,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                    Button(onClick = { currentOnContinue.value() }) {
                        Text("Продолжить")
                    }
                }
            }
        }
    }
}
