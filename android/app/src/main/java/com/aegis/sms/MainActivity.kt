package com.aegis.sms

import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import com.getcapacitor.BridgeActivity

/**
 * MainActivity — The primary Activity that hosts the Capacitor WebView.
 *
 * This Activity renders the existing Next.js web app (Aegis) inside a native
 * Android WebView. The web app remains unchanged — all UI, routing, and logic
 * run in JavaScript as before. The native layer only adds SMS reading capability
 * via the AegisSmsPlugin bridge.
 *
 * Also serves as the "compose new message" Activity required by the default
 * SMS app specification (handles ACTION_SENDTO with sms:/smsto: schemes).
 * When launched from an external "share to SMS" intent, it passes the
 * recipient number and body text to the web layer via the bridge.
 *
 * Phase D Security: FLAG_SECURE is applied when the app is showing sensitive
 * content (OTP reveal, vault). This is controlled dynamically via the
 * AegisSmsPlugin.setSecureScreen() method.
 */
class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Register the Aegis SMS plugin so it's accessible from JS
        registerPlugin(AegisSmsPlugin::class.java)

        // Handle "compose new message" intents (ACTION_SENDTO with sms:/smsto:)
        handleComposeIntent()
    }

    /**
     * Apply or remove FLAG_SECURE on the window.
     *
     * When FLAG_SECURE is set:
     * - Screenshots are blocked (shows black rectangle)
     * - Screen recording is blocked
     * - Content is hidden from the app switcher preview
     *
     * Called by AegisSmsPlugin.setSecureScreen() when the user enters
     * an OTP reveal screen or vault unlock dialog.
     *
     * @param secure true to enable FLAG_SECURE, false to disable
     */
    fun setSecureScreen(secure: Boolean) {
        runOnUiThread {
            if (secure) {
                window.setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                )
                android.util.Log.i(TAG, "FLAG_SECURE enabled — screenshots blocked")
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                android.util.Log.i(TAG, "FLAG_SECURE disabled — screenshots allowed")
            }
        }
    }

    /**
     * Handle incoming ACTION_SENDTO intents.
     *
     * When another app (e.g., contacts, dialer) triggers "send SMS to X",
     * Android routes it here because Aegis is the default SMS app.
     * We extract the recipient and body, then pass them to the web layer
     * via the bridge so the compose dialog opens pre-filled.
     */
    private fun handleComposeIntent() {
        val intent = intent ?: return
        val action = intent.action ?: return

        if (action == android.content.Intent.ACTION_SENDTO ||
            action == android.content.Intent.ACTION_SEND) {

            val data = intent.data
            var recipient: String? = null
            var body: String? = null

            // Extract recipient from sms:/smsto: URI
            if (data != null) {
                val scheme = data.scheme
                if (scheme == "sms" || scheme == "smsto" || scheme == "mms" || scheme == "mmsto") {
                    recipient = data.schemeSpecificPart
                    // Remove any trailing query params
                    recipient = recipient?.substringBefore("?")
                }
            }

            // Extract body text from EXTRA_SMS_BODY or EXTRA_TEXT
            body = intent.getStringExtra(android.content.Intent.EXTRA_SMS_BODY)
                ?: intent.getStringExtra(android.content.Intent.EXTRA_TEXT)

            android.util.Log.i(TAG, "Compose intent: recipient=$recipient, body=$body")

            // Pass to web layer — the bridge will call window.AegisNative.onComposeIntent()
            if (recipient != null || body != null) {
                AegisSmsBridge.notifyComposeIntent(recipient, body)
            }
        }
    }

    companion object {
        private const val TAG = "AegisMain"
    }
}
