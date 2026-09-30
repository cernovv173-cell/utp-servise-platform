package ru.utp.servise.data

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

object PushTokenManager {
    fun synchronize(context: Context, sessionToken: String) {
        if (FirebaseApp.getApps(context).isEmpty()) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { pushToken ->
            Thread(
                { runCatching { ApiClient.registerPushToken(sessionToken, pushToken) } },
                "utp-push-token-registration",
            ).start()
        }
    }
}
