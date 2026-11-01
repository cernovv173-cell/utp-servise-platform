package ru.utp.servise.data

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

object PushTokenManager {
    // Единственное место получения FCM-токена. Метод getToken() помечен в библиотеке как устаревший:
    // его замена требует новой схемы регистрации (register/unregister и настройка в манифесте),
    // которая меняет доставку уведомлений для всех пользователей, поэтому переход нужно проверить на устройстве.
    @Suppress("DEPRECATION")
    fun fetchToken(): Task<String> = FirebaseMessaging.getInstance().token

    fun synchronize(context: Context, sessionToken: String) {
        if (FirebaseApp.getApps(context).isEmpty()) return
        fetchToken().addOnSuccessListener { pushToken ->
            Thread(
                { runCatching { ApiClient.registerPushToken(sessionToken, pushToken) } },
                "utp-push-token-registration",
            ).start()
        }
    }
}
