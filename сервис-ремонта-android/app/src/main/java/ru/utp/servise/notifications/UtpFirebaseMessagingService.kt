package ru.utp.servise.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import ru.utp.servise.MainActivity
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.SessionStore

class UtpFirebaseMessagingService : FirebaseMessagingService() {
    override fun onCreate() {
        super.onCreate()
        NotificationChannels.ensureCreated(this)
    }

    // Метод помечен устаревшим в библиотеке firebase-messaging. Переход на его замену нужно
    // проверить на устройстве, поэтому пока он оставлен без изменений.
    @Suppress("OVERRIDE_DEPRECATION")
    override fun onNewToken(token: String) {
        if (FirebaseApp.getApps(this).isEmpty()) return
        val sessionToken = runCatching { SessionStore(applicationContext).readToken() }
            .getOrNull()
            ?.takeIf(String::isNotBlank)
            ?: return
        runCatching { ApiClient.registerPushToken(sessionToken, token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val fallbackTitle = when (message.data["type"]) {
            "news_published" -> "Новая новость ЕНОТ СЕРВИС"
            "customer_offer_published" -> "Новая акция или розыгрыш"
            "customer_offer_winner" -> "Поздравляем с победой! 🎉"
            "help_request" -> "Новый запрос помощи"
            "support_chat_message" -> "Новое сообщение в чате поддержки"
            "maintenance_reminder" -> "Пора обслужить технику"
            "repair_order_completed" -> "Ремонт завершён"
            "repair_order_ready" -> "Ремонт готов к выдаче"
            else -> "Новое сообщение по ремонту"
        }
        val title = message.notification?.title ?: fallbackTitle
        val body = message.notification?.body ?: "Откройте приложение, чтобы посмотреть обновление."
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            (message.data["notificationId"] ?: message.data["orderId"])?.hashCode() ?: 0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = Notification.Builder(this, NotificationChannels.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId =
            (message.data["notificationId"] ?: message.data["orderId"])
                ?.hashCode()
                ?: System.currentTimeMillis().toInt()
        runCatching { manager.notify(notificationId, notification) }
    }
}

object NotificationChannels {
    const val CHANNEL_ID = "repair_updates"

    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Сообщения и запросы помощи",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Сообщения по ремонту, запросы помощи и напоминания об обслуживании."
        }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }
}
