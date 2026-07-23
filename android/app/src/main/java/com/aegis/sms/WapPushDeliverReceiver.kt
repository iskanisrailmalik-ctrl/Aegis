package com.aegis.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * WapPushDeliverReceiver — Requirement #2 for Default SMS App.
 *
 * This BroadcastReceiver receives MMS (Multimedia Messaging Service) delivery
 * via the WAP_PUSH_DELIVER action. Only the default SMS app receives this.
 *
 * For Aegis, MMS handling is minimal — we simply acknowledge receipt and log it.
 * Full MMS parsing is complex and beyond the scope of a finance tracker (bank
 * SMS are always text-only, never MMS). However, the receiver MUST exist and
 * be registered in the manifest for Aegis to qualify as a default SMS app.
 *
 * The manifest registers this receiver with:
 *   android:permission="android.permission.BROADCAST_WAP_PUSH"
 */
class WapPushDeliverReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "android.provider.Telephony.WAP_PUSH_DELIVER") {
            return
        }

        val mimeType = intent.type
        Log.i(TAG, "WAP_PUSH_DELIVER received: type=$mimeType")

        // MMS data
        val data = intent.getByteArrayExtra("data")
        Log.d(TAG, "MMS data size: ${data?.size ?: 0} bytes")

        // Acknowledge receipt — for a full MMS implementation, we would:
        // 1. Parse the MMS PDU (Multimedia Message Protocol Data Unit)
        // 2. Extract sender, subject, and content (images, text)
        // 3. Insert into content://mms-sms database
        // 4. Forward to web layer
        //
        // For Aegis (finance tracker), we just log and acknowledge.
        // Bank SMS never use MMS, so this is sufficient for compliance.
    }

    companion object {
        private const val TAG = "AegisMmsRx"
    }
}
