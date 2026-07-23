package com.aegis.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import org.json.JSONObject

/**
 * SmsDeliverReceiver — Requirement #1 for Default SMS App.
 *
 * This BroadcastReceiver receives incoming SMS via the SMS_DELIVER action.
 * This is DIFFERENT from SMS_RECEIVED — only the default SMS app receives
 * SMS_DELIVER, and it is the authoritative "you have a new SMS" signal.
 *
 * Responsibilities:
 * 1. Extract sender and message body from the PDUs
 * 2. Insert the message into the content://sms provider (required — as the
 *    default app, Aegis is responsible for writing to the SMS database)
 * 3. Forward the message to the web layer via the Capacitor bridge so the
 *    existing parser pipeline (parseSms → detectScam → categorize → create
 *    SmsMessage) processes it exactly like a pasted message
 * 4. If the message contains an OTP, the web layer will blur it automatically
 *
 * The manifest registers this receiver with:
 *   android:permission="android.permission.BROADCAST_SMS"
 * which ensures only the system can deliver broadcasts to it.
 */
class SmsDeliverReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_DELIVER_ACTION) {
            return
        }

        Log.i(TAG, "SMS_DELIVER received")

        // Extract SMS messages from the PDUs
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) {
            Log.w(TAG, "No messages in SMS_DELIVER intent")
            return
        }

        // Combine message parts (long SMS may be split into multiple PDUs)
        val sender = messages[0].displayOriginatingAddress ?: messages[0].originatingAddress ?: "Unknown"
        val body = messages.joinToString("") { it.displayMessageBody ?: it.messageBody ?: "" }
        val timestamp = System.currentTimeMillis()

        Log.i(TAG, "SMS from $sender: ${body.take(80)}${if (body.length > 80) "..." else ""}")

        // --- Phase C: Write to content://sms provider ---
        // As the default SMS app, we are responsible for inserting the
        // message into the SMS content provider. This ensures the message
        // appears in the system SMS database and other apps can read it.
        try {
            val smsValues = android.content.ContentValues().apply {
                put(android.provider.Telephony.Sms.ADDRESS, sender)
                put(android.provider.Telephony.Sms.BODY, body)
                put(android.provider.Telephony.Sms.DATE, timestamp)
                put(android.provider.Telephony.Sms.READ, 0) // unread
                put(android.provider.Telephony.Sms.SEEN, 0)
                put(android.provider.Telephony.Sms.TYPE, android.provider.Telephony.Sms.MESSAGE_TYPE_INBOX)
            }
            context.contentResolver.insert(
                android.provider.Telephony.Sms.CONTENT_URI,
                smsValues
            )
            Log.i(TAG, "SMS inserted into content://sms")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to insert SMS into provider", e)
            // Non-fatal — we still forward to the web layer
        }

        // --- Forward to web layer via Capacitor bridge ---
        // The bridge will call window.AegisNative.onSmsReceived() in the WebView,
        // which feeds the message into the existing parse pipeline.
        val smsEvent = JSONObject().apply {
            put("id", "sms_${timestamp}")
            put("sender", sender)
            put("body", body)
            put("timestamp", timestamp)
            put("date", java.util.Date(timestamp).toInstant().toString())
        }

        AegisSmsBridge.notifySmsReceived(smsEvent)

        // --- Show a notification ---
        // As the default SMS app, we're responsible for notifying the user.
        // The web layer handles the toast/voice, but we also post a system
        // notification so the user sees it even if the app is in background.
        AegisNotificationManager.showSmsNotification(context, sender, body, timestamp)
    }

    companion object {
        private const val TAG = "AegisSmsRx"
    }
}
