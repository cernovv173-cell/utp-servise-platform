package ru.utp.servise.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONObject
import ru.utp.servise.BuildConfig

private const val SERVICE_SESSION_TOKEN_KEY = "utp-web-token"

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }

private fun Uri.isAllowedServiceOrigin(base: Uri): Boolean =
    scheme.equals("https", ignoreCase = true) &&
        host.equals(base.host, ignoreCase = true) &&
        port == base.port &&
        userInfo.isNullOrEmpty()

@Composable
fun RaccoonGameWebViewScreen(
    token: String,
    onBack: () -> Unit,
    onDailyPuzzle: () -> Unit,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val baseUri = remember {
        Uri.parse(BuildConfig.SERVICE_WEB_BASE_URL)
    }
    val gameUrl = remember(baseUri) {
        baseUri.buildUpon()
            .appendPath("game")
            .appendQueryParameter("embedded", "android")
            .build()
            .toString()
    }
    var isLoading by remember(token) { mutableStateOf(true) }
    var loadError by remember(token) { mutableStateOf<String?>(null) }

    DisposableEffect(activity) {
        val previousOrientation = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose {
            if (previousOrientation != null) {
                activity?.requestedOrientation = previousOrientation
            }
        }
    }

    val webView = remember(context, token, gameUrl) {
        WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

            webViewClient = object : WebViewClient() {
                private var sessionInstalled = false
                private val quotedToken = JSONObject.quote(token)
                private val quotedGameUrl = JSONObject.quote(gameUrl)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val destination = request.url
                    if (!destination.isAllowedServiceOrigin(baseUri)) return true
                    if (request.isForMainFrame && destination.path == "/game/daily") {
                        onDailyPuzzle()
                        return true
                    }
                    return false
                }

                override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                    isLoading = true
                    loadError = null
                }

                override fun onPageFinished(view: WebView, url: String) {
                    val pageUri = Uri.parse(url)
                    if (!pageUri.isAllowedServiceOrigin(baseUri)) {
                        isLoading = false
                        loadError = "Страница игры перешла на недоверенный адрес."
                        return
                    }

                    if (sessionInstalled) {
                        isLoading = false
                        loadError = null
                        return
                    }

                    val handoffScript = """
                        (function() {
                          try {
                            window.sessionStorage.setItem('$SERVICE_SESSION_TOKEN_KEY', $quotedToken);
                            window.location.replace($quotedGameUrl);
                            return true;
                          } catch (_) {
                            return false;
                          }
                        })()
                    """.trimIndent()
                    sessionInstalled = true
                    view.evaluateJavascript(handoffScript) { result ->
                        if (result == "true") {
                            isLoading = true
                            loadError = null
                        } else {
                            sessionInstalled = false
                            isLoading = false
                            loadError = "Не удалось открыть игру с аккаунтом клиента."
                        }
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    if (request.isForMainFrame) {
                        isLoading = false
                        loadError = "Проверьте подключение к интернету и повторите попытку."
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView,
                    request: WebResourceRequest,
                    errorResponse: WebResourceResponse,
                ) {
                    if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                        isLoading = false
                        loadError = "Игра временно недоступна. Попробуйте позже."
                    }
                }
            }
            loadUrl(gameUrl)
        }
    }

    DisposableEffect(webView) {
        onDispose {
            webView.stopLoading()
            if (webView.url?.let(Uri::parse)?.isAllowedServiceOrigin(baseUri) == true) {
                webView.evaluateJavascript(
                    "window.sessionStorage.removeItem('$SERVICE_SESSION_TOKEN_KEY');",
                    null,
                )
            }
            webView.removeAllViews()
            webView.destroy()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        Surface(color = MaterialTheme.colorScheme.primary) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) {
                    Text("Назад", color = Color.White)
                }
                Text(
                    text = "Три в ряд",
                    modifier = Modifier.weight(1f),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
                TextButton(onClick = onDailyPuzzle) {
                    Text("Испытание", color = Color.White)
                }
            }
        }

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            AndroidView(
                factory = { webView },
                modifier = Modifier.fillMaxSize(),
                update = { it.onResume() },
            )

            if (isLoading && loadError == null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.38f)),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }

            loadError?.let { message ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.65f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Card(modifier = Modifier.fillMaxWidth().padding(24.dp)) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text("Игра временно недоступна", fontWeight = FontWeight.Bold)
                            Text(message, modifier = Modifier.padding(top = 8.dp))
                            Button(
                                onClick = {
                                    loadError = null
                                    isLoading = true
                                    webView.loadUrl(gameUrl)
                                },
                                modifier = Modifier.padding(top = 12.dp),
                            ) {
                                Text("Повторить")
                            }
                        }
                    }
                }
            }
        }
    }
}
