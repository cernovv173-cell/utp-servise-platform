package ru.utp.servise.ui

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/** Device-synthesized Russian speech, kept off Compose's main thread. */
internal class RaccoonSpeech(
    context: Context,
    private val onAvailabilityChanged: (Boolean) -> Unit,
    private val onSpeakingChanged: (Boolean) -> Unit,
) {
    private val engineThread = HandlerThread("raccoon-tts").apply { start() }
    private val engineHandler = Handler(engineThread.looper)
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var disposed = false

    // Engine state and queued text are accessed only on engineHandler.
    private var engine: TextToSpeech? = null
    private var initialized = false
    private var pendingLine: String? = null

    init {
        engineHandler.post {
            if (disposed) return@post
            try {
                engine = TextToSpeech(context.applicationContext) { status ->
                    // Queue on the same looper so even an immediate init callback runs only
                    // after the constructor has returned and engine has been assigned.
                    engineHandler.post { initialize(status) }
                }
            } catch (_: RuntimeException) {
                reportAvailability(false)
            }
        }
    }

    fun speak(text: String) {
        if (disposed || text.isBlank()) return
        engineHandler.post {
            if (disposed) return@post
            val tts = engine
            if (tts == null || !initialized) {
                pendingLine = text
                return@post
            }
            pendingLine = null
            speakNow(tts, text)
        }
    }

    fun stop() {
        if (disposed) return
        engineHandler.post {
            if (disposed) return@post
            pendingLine = null
            engine?.stop()
            reportSpeaking(false)
        }
    }

    fun shutdown() {
        if (disposed) return
        disposed = true
        val posted = engineHandler.post {
            engine?.stop()
            engine?.shutdown()
            engine = null
            initialized = false
            engineThread.quitSafely()
        }
        if (!posted) engineThread.quitSafely()
    }

    private fun initialize(status: Int) {
        if (disposed) return
        val tts = engine ?: run {
            reportAvailability(false)
            return
        }
        val languageResult = if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(Locale.forLanguageTag("ru-RU"))
        } else {
            TextToSpeech.LANG_NOT_SUPPORTED
        }
        initialized = languageResult != TextToSpeech.LANG_MISSING_DATA &&
            languageResult != TextToSpeech.LANG_NOT_SUPPORTED

        if (initialized) {
            tts.setSpeechRate(0.94f)
            tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = reportSpeaking(true)

                override fun onDone(utteranceId: String?) = reportSpeaking(false)

                override fun onError(utteranceId: String?) = reportSpeaking(false)

                override fun onError(utteranceId: String?, errorCode: Int) = reportSpeaking(false)

                override fun onStop(utteranceId: String?, interrupted: Boolean) = reportSpeaking(false)
            })
        }

        reportAvailability(initialized)
        if (initialized) {
            pendingLine?.let { line ->
                pendingLine = null
                speakNow(tts, line)
            }
        } else {
            pendingLine = null
        }
    }

    private fun speakNow(tts: TextToSpeech, text: String) {
        tts.stop()
        val result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "raccoon-${System.nanoTime()}")
        if (result == TextToSpeech.ERROR) reportSpeaking(false)
    }

    private fun reportAvailability(available: Boolean) {
        if (disposed) return
        mainHandler.post {
            if (!disposed) onAvailabilityChanged(available)
        }
    }

    private fun reportSpeaking(speaking: Boolean) {
        if (disposed) return
        mainHandler.post {
            if (!disposed) onSpeakingChanged(speaking)
        }
    }
}
