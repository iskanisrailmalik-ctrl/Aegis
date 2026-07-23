package com.aegis.sms

import android.content.Context
import android.util.Log
import org.json.JSONObject

/**
 * AegisSmsBridge — Singleton bridge between native Android and the WebView.
 *
 * This is NOT a Capacitor plugin itself (that's AegisSmsPlugin), but rather
 * a singleton that holds the state and listeners. It allows native components
 * (BroadcastReceivers, Services) to communicate with the WebView even when
 * the Activity isn't in the foreground.
 *
 * Flow:
 * 1. SmsDeliverReceiver receives an SMS → calls AegisSmsBridge.notifySmsReceived()
 * 2. The bridge stores the event in a pending queue
 * 3. When the WebView is active, AegisSmsPlugin checks the queue and delivers
 *    events to JavaScript via notifyListeners("smsReceived", event)
 * 4. If the WebView is not yet loaded, events are queued and delivered on next poll
 *
 * This decoupling ensures no SMS is lost even if the app is cold-started
 * by an incoming SMS broadcast.
 */
class AegisSmsBridge {

    companion object {
        private const val TAG = "AegisBridge"

        @Volatile
        private var instance: AegisSmsBridge? = null

        fun getInstance(): AegisSmsBridge {
            return instance ?: synchronized(this) {
                instance ?: AegisSmsBridge().also { instance = it }
            }
        }

        /**
         * Initialize the bridge with the application context.
         * Called from AegisApplication.onCreate().
         */
        fun initialize(context: Context) {
            getInstance().appContext = context.applicationContext
            Log.i(TAG, "Aegis SMS Bridge initialized")
        }

        /**
         * Called by SmsDeliverReceiver when a new SMS arrives.
         * Queues the event for delivery to the WebView.
         */
        fun notifySmsReceived(smsEvent: JSONObject) {
            getInstance().enqueueSmsEvent(smsEvent)
        }

        /**
         * Called by MainActivity when a compose intent is received
         * (ACTION_SENDTO from external app).
         */
        fun notifyComposeIntent(recipient: String?, body: String?) {
            getInstance().enqueueComposeEvent(recipient, body)
        }
    }

    private var appContext: Context? = null

    // Pending SMS events waiting for the WebView to consume
    private val pendingSmsEvents = mutableListOf<JSONObject>()
    private val pendingComposeEvents = mutableListOf<JSONObject>()

    // Capacitor plugin reference for direct delivery when WebView is active
    @Volatile
    private var activePlugin: AegisSmsPlugin? = null

    /**
     * Called by AegisSmsPlugin when it's ready to receive events.
     */
    fun setActivePlugin(plugin: AegisSmsPlugin?) {
        activePlugin = plugin
        if (plugin != null) {
            // Deliver any pending events
            deliverPendingEvents()
        }
    }

    /**
     * Enqueue an SMS event for delivery to the WebView.
     * If the plugin is active, deliver immediately; otherwise queue.
     */
    private fun enqueueSmsEvent(event: JSONObject) {
        synchronized(pendingSmsEvents) {
            val plugin = activePlugin
            if (plugin != null) {
                // Deliver immediately
                plugin.deliverSmsEvent(event)
            } else {
                // Queue for later delivery
                pendingSmsEvents.add(event)
                Log.i(TAG, "SMS event queued (${pendingSmsEvents.size} pending)")
            }
        }
    }

    /**
     * Enqueue a compose intent event.
     */
    private fun enqueueComposeEvent(recipient: String?, body: String?) {
        synchronized(pendingComposeEvents) {
            val event = JSONObject().apply {
                put("recipient", recipient ?: JSONObject.NULL)
                put("body", body ?: JSONObject.NULL)
            }
            val plugin = activePlugin
            if (plugin != null) {
                plugin.deliverComposeEvent(event)
            } else {
                pendingComposeEvents.add(event)
                Log.i(TAG, "Compose event queued")
            }
        }
    }

    /**
     * Deliver all pending events to the active plugin.
     * Called when the plugin registers itself.
     */
    private fun deliverPendingEvents() {
        synchronized(pendingSmsEvents) {
            val plugin = activePlugin ?: return
            for (event in pendingSmsEvents) {
                plugin.deliverSmsEvent(event)
            }
            pendingSmsEvents.clear()

            for (event in pendingComposeEvents) {
                plugin.deliverComposeEvent(event)
            }
            pendingComposeEvents.clear()
        }
    }
}
