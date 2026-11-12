package ru.utp.servise.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

object NotificationChannels {
    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channels = listOf(
            NotificationChannel(
                NotificationChannelRouting.UPDATES_CHANNEL_ID,
                "Обновления сервиса",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Сообщения и новости с фирменным звуком «Мягкая искра»."
                setSound(soundUri(context, "utp_notification_spark"), audioAttributes)
            },
            NotificationChannel(
                NotificationChannelRouting.WINNER_CHANNEL_ID,
                "Победы в розыгрышах",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Поздравления с победой — отдельный праздничный звук."
                setSound(soundUri(context, "utp_notification_winner"), audioAttributes)
            },
            NotificationChannel(
                NotificationChannelRouting.SHOP_CHANNEL_ID,
                "Заказы магазина",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Новые заказы магазина и ответы клиентов по доставке."
                setSound(soundUri(context, "utp_notification_spark"), audioAttributes)
            },
        )

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannels(channels)
    }

    private fun soundUri(context: Context, resourceName: String): Uri =
        Uri.parse("android.resource://${context.packageName}/raw/$resourceName")
}
