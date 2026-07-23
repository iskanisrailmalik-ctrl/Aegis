package com.aegis.sms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * AegisNotificationManager — Posts system notifications for incoming SMS.
 *
 * As the default SMS app, Aegis is responsible for notifying the user when
 * a new SMS arrives. This class creates and posts notifications on the
 * "sms_incoming" channel.
 *
 * Features:
 * - Notification channel creation (required for Android 8+)
 * - Notification with sender name and message preview
 * - OTP messages are blurred in the notification (security)
 * - Tap notification → opens MainActivity (the web app)
 * - Quick-reply action via RemoteInput (handled by HeadlessSmsSendService)
 */
object AegisNotificationManager {

    private const val TAG = "AegisNotif"
    private const val CHANNEL_ID = "sms_incoming"
    private const val CHANNEL_NAME = "Incoming SMS"
    private const val NOTIFICATION_ID_BASE = 1000

    /**
     * Create the notification channel (required for Android 8+).
     * Called once on app startup.
     */
    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming SMS messages"
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
            Log.i(TAG, "Notification channel created")
        }
    }

    /**
     * Show a notification for an incoming SMS.
     *
     * @param sender The sender address
     * @param body The message body (will be blurred if it contains an OTP)
     * @param timestamp The message timestamp
     */
    fun showSmsNotification(context: Context, sender: String, body: String, timestamp: Long) {
        createChannel(context)

        // Check if the message contains an OTP — if so, blur it in the notification
        val displayBody = if (isOtpMessage(body)) {
            blurOtp(body)
        } else {
            body
        }

        // Tap intent — opens MainActivity
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val tapPendingIntent = PendingIntent.getActivity(
            context,
            timestamp.toInt(),
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build the notification
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(sender)
            .setContentText(displayBody)
            .setStyle(NotificationCompat.BigTextStyle().bigText(displayBody))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tapPendingIntent)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE) // Hide on lock screen
            .build()

        try {
            NotificationManagerCompat.from(context).notify(
                (NOTIFICATION_ID_BASE + timestamp % 1000).toInt(),
                notification
            )
            Log.i(TAG, "SMS notification posted for $sender")
        } catch (e: SecurityException) {
            Log.e(TAG, "Notification permission denied", e)
        }
    }

    /**
     * Simple OTP detection — mirrors the TypeScript otp-detector.ts logic.
     * Checks if the message body contains an OTP pattern.
     */
    private fun isOtpMessage(text: String): Boolean {
        val patterns = listOf(
            Regex("(?i)\\b(?:otp|verification\\s+code|security\\s+code|access\\s+code)\\b"),
            Regex("(?i)\\b(?:don'?t\\s+share|do\\s+not\\s+share|never\\s+share)\\b"),
            Regex("(?i)\\b(?:upi\\s+pin|mpin|cvv)\\b"),
            Regex("\\b\\d{4,8}\\b.*(?i)(?:otp|code|pin)")
        )
        return patterns.any { it.containsMatchIn(text) }
    }

    /**
     * Blur OTP digits in a message — replaces 4-8 digit numbers with ●●●●.
     */
    private fun blurOtp(text: String): String {
        return text.replace(Regex("\\b\\d{4,8}\\b")) { match ->
            "●".repeat(match.value.length)
        }
    }
}
