package ru.utp.servise.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.ImageDecoder
import android.graphics.Movie
import android.graphics.drawable.AnimatedImageDrawable
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.ImageView
import ru.utp.servise.R
import kotlin.math.min

internal fun createWelcomeGifView(context: Context): View {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val animatedImage = runCatching {
            ImageDecoder.decodeDrawable(
                ImageDecoder.createSource(context.resources, R.raw.welcome_intro),
            ) as? AnimatedImageDrawable
        }.getOrNull()
        if (animatedImage != null) {
            animatedImage.repeatCount = AnimatedImageDrawable.REPEAT_INFINITE
            animatedImage.start()
            return ImageView(context).apply {
                setImageDrawable(animatedImage)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "Приветственная анимация UTP Servise"
            }
        }
    }

    val movie = context.resources.openRawResource(R.raw.welcome_intro).use {
        Movie.decodeStream(it)
    }
    return if (movie == null) {
        welcomeStillImage(context)
    } else {
        WelcomeGifView(context, movie)
    }
}

private fun welcomeStillImage(context: Context) = ImageView(context).apply {
    setImageResource(R.drawable.raccoon_welcome)
    scaleType = ImageView.ScaleType.FIT_CENTER
    contentDescription = "Енот UTP Servise"
}

private class WelcomeGifView(
    context: Context,
    private val movie: Movie,
) : View(context) {
    private var startedAt = 0L

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)
        contentDescription = "Приветственная анимация UTP Servise"
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        startedAt = SystemClock.uptimeMillis()
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val movieWidth = movie.width()
        val movieHeight = movie.height()
        if (width <= 0 || height <= 0 || movieWidth <= 0 || movieHeight <= 0) return

        val scale = min(width.toFloat() / movieWidth, height.toFloat() / movieHeight)
        val left = (width - movieWidth * scale) / 2f
        val top = (height - movieHeight * scale) / 2f
        val duration = movie.duration().coerceAtLeast(1)
        movie.setTime(((SystemClock.uptimeMillis() - startedAt) % duration).toInt())

        val checkpoint = canvas.save()
        canvas.translate(left, top)
        canvas.scale(scale, scale)
        movie.draw(canvas, 0f, 0f)
        canvas.restoreToCount(checkpoint)

        if (isAttachedToWindow) postInvalidateOnAnimation()
    }
}
