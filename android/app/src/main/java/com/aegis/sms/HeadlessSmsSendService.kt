package com.aegis.sms

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * HeadlessSmsSendService — Requirement #3 for Default SMS App.
 *
 * This service handles the RESPOND_VIA_MESSAGE intent, which is triggered
 * when a user taps "Reply" from an SMS notification or uses quick-reply.
 *
 * Android requires this service to exist and be registered in the manifest
 * with the RESPOND_VIA_MESSAGE action and SEND_RESPOND_VIA_MESSAGE permission.
 *
 * For Aegis, quick-reply is handled by sending the SMS via SmsManager.
 * The reply is also forwarded to the web layer so it appears in the
 * conversation thread.
 */
class HeadlessSmsSendService : Service() {

    override fun onBind(intent: Intent?): IBinder? {
        return null // Not bindable — headless service
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "android.intent.action.RESPOND_VIA_MESSAGE") {
            handleQuickReply(intent)
        }
        // Stop the service after handling — this is a one-shot operation
        stopSelf(startId)
        return START_NOT_STICKY
    }

    /**
     * Handle a quick-reply request from a notification.
     *
     * Extracts the recipient (from the intent data URI) and the reply text
     * (from EXTRA_REMOTE_INPUT), then sends the SMS via SmsManager.
     */
    private fun handleQuickReply(intent: Intent) {
        val data = intent.data
        val recipients = data?.schemeSpecificPart
            ?.substringBefore("?")
            ?.split(",")
            ?: emptyList()

        // The reply text comes from the RemoteInput (notification input)
        val replyText = intent.getStringExtra(Intent.EXTRA_TEXT)
            ?: intent.getCharSequenceExtra("android.intent.extra.TEXT")?.toString()
            ?: ""

        if (recipients.isEmpty() || replyText.isBlank()) {
            Log.w(TAG, "Quick reply missing recipient or text")
            return
        }

        Log.i(TAG, "Quick reply to $recipients: ${replyText.take(50)}")

        // Send the SMS via SmsManager
        try {
            val smsManager = android.telephony.SmsManager.getDefault()
            for (recipient in recipients) {
                val parts = smsManager.divideMessage(replyText)
                smsManager.sendMultipartTextMessage(
                    recipient.trim(),
                    null,
                    parts,
                    null,
                    null
                )
            }

            // Insert the sent message into content://sms
            for (recipient in recipients) {
                val values = android.content.ContentValues().apply {
                    put(android.provider.Telephony.Sms.ADDRESS, recipient.trim())
                    put(android.provider.Telephony.Sms.BODY, replyText)
                    put(android.provider.Telephony.Sms.DATE, System.currentTimeMillis())
                    put(android.provider.Telephony.Sms.READ, 1)
                    put(android.provider.Telephony.Sms.SEEN, 1)
                    put(android.provider.Telephony.Sms.TYPE, android.provider.Telephony.Sms.MESSAGE_TYPE_SENT)
                }
                contentResolver.insert(
                    android.provider.Telephony.Sms.Sent.CONTENT_URI,
                    values
                )
            }

            Log.i(TAG, "Quick reply sent and stored")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send quick reply", e)
        }
    }

    companion object {
        private const val TAG = "AegisQuickReply"
    }
}
