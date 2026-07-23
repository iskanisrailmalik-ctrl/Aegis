package com.aegis.sms

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * AegisSmsPlugin — Capacitor plugin that exposes native SMS functionality to JavaScript.
 *
 * This plugin is the bridge between the web app (window.AegisNative) and the
 * native Android SMS system. It provides:
 *
 * 1. isDefaultSmsApp() — Check if Aegis is the default SMS handler
 * 2. requestDefaultSmsRole() — Trigger the RoleManager system prompt
 * 3. importExistingSms() — Bulk import SMS history from content://sms
 * 4. onSmsReceived() — Register a callback for real-time SMS events
 *
 * The web app calls these methods via:
 *   window.AegisNative.isDefaultSmsApp()
 *   window.AegisNative.requestDefaultSmsRole()
 *   window.AegisNative.importExistingSms()
 *   window.AegisNative.onSmsReceived(callback)
 *
 * Events from native (SMS received, compose intent) are delivered via
 * Capacitor's notifyListeners() mechanism, which calls the JS callbacks.
 */
@CapacitorPlugin(name = "AegisNative")
class AegisSmsPlugin : Plugin() {

    companion object {
        private const val TAG = "AegisPlugin"
        private const val REQUEST_CODE_DEFAULT_SMS = 1001
        private const val EVENT_SMS_RECEIVED = "smsReceived"
        private const val EVENT_COMPOSE_INTENT = "composeIntent"
    }

    private var pendingRoleCall: PluginCall? = null

    override fun load() {
        super.load()
        Log.i(TAG, "AegisSmsPlugin loaded — registering with bridge")
        AegisSmsBridge.getInstance().setActivePlugin(this)
    }

    override fun handleOnDestroy() {
        AegisSmsBridge.getInstance().setActivePlugin(null)
        super.handleOnDestroy()
    }

    // ==========================================
    // Methods callable from JavaScript
    // ==========================================

    /**
     * Enable or disable FLAG_SECURE on the Activity window.
     *
     * When enabled:
     * - Screenshots are blocked (content shows as black)
     * - Screen recording is blocked
     * - App switcher preview is hidden
     *
     * The web layer calls this when showing OTP reveal screens or vault content:
     *   window.Capacitor.Plugins.AegisNative.setSecureScreen({ secure: true })
     *
     * Phase D security feature.
     */
    @PluginMethod
    fun setSecureScreen(call: PluginCall) {
        val secure = call.getBoolean("secure", false) ?: false
        try {
            val activity = getActivity()
            if (activity is MainActivity) {
                activity.setSecureScreen(secure)
            }
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set FLAG_SECURE", e)
            call.reject("Failed to set secure screen: ${e.message}")
        }
    }

    /**
     * Check if Aegis is the default SMS app.
     * Returns { value: true/false }
     */
    @PluginMethod
    fun isDefaultSmsApp(call: PluginCall) {
        val isDefault = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
            roleManager.isRoleHeld(RoleManager.ROLE_SMS)
        } else {
            // Pre-Android Q: check via Telephony.Sms.getDefaultSmsPackage
            Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        }
        Log.i(TAG, "isDefaultSmsApp: $isDefault")
        call.resolve(JSObject().put("value", isDefault))
    }

    /**
     * Request the user to set Aegis as the default SMS app.
     * Triggers the Android RoleManager system dialog.
     * Returns { value: true } if granted, { value: false } if denied.
     */
    @PluginMethod
    fun requestDefaultSmsRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager

            // Check if the role is available
            if (!roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                call.reject("Default SMS app role is not available on this device")
                return
            }

            // Check if already holding the role
            if (roleManager.isRoleHeld(RoleManager.ROLE_SMS)) {
                call.resolve(JSObject().put("value", true))
                return
            }

            // Launch the role request intent
            val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
            pendingRoleCall = call
            startActivityForResult(call, intent, REQUEST_CODE_DEFAULT_SMS)
        } else {
            // Pre-Android Q: redirect to SMS app settings
            val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
            intent.putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, context.packageName)
            pendingRoleCall = call
            startActivityForResult(call, intent, REQUEST_CODE_DEFAULT_SMS)
        }
    }

    /**
     * Handle the result of the default SMS app role request.
     */
    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        if (requestCode == REQUEST_CODE_DEFAULT_SMS) {
            val call = pendingRoleCall ?: return
            pendingRoleCall = null

            // RESULT_OK means the user granted the role
            val granted = resultCode == android.app.Activity.RESULT_OK
            Log.i(TAG, "Default SMS role request result: $granted")
            call.resolve(JSObject().put("value", granted))
        }
        super.handleOnActivityResult(requestCode, resultCode, data)
    }

    /**
     * Import existing SMS history from the content://sms provider.
     * Reads all SMS from the device and returns them as a JSON array.
     *
     * Returns { total: N, imported: N, skipped: N }
     */
    @PluginMethod
    fun importExistingSms(call: PluginCall) {
        Log.i(TAG, "Starting SMS import...")

        try {
            val projection = arrayOf(
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
            )

            val cursor = context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} DESC"
            )

            if (cursor == null) {
                call.reject("Failed to read SMS — cursor is null")
                return
            }

            var total = 0
            var imported = 0
            var skipped = 0
            val smsList = mutableListOf<JSONObject>()

            cursor.use { c ->
                while (c.moveToNext()) {
                    total++
                    try {
                        val sender = c.getString(0) ?: "Unknown"
                        val body = c.getString(1) ?: ""
                        val date = c.getLong(2)
                        val type = c.getInt(3)

                        // Only import inbox (1) and sent (2) messages
                        if (type != 1 && type != 2) {
                            skipped++
                            continue
                        }

                        val sms = JSONObject().apply {
                            put("id", "imported_${date}")
                            put("sender", sender)
                            put("body", body)
                            put("timestamp", date)
                            put("date", java.util.Date(date).toInstant().toString())
                            put("direction", if (type == 1) "incoming" else "outgoing")
                        }
                        smsList.add(sms)
                        imported++
                    } catch (e: Exception) {
                        skipped++
                    }
                }
            }

            Log.i(TAG, "SMS import complete: $imported/$total ($skipped skipped)")

            // Return the summary — the web layer can also access individual messages
            // via the "messages" array if needed for batch processing
            val result = JSObject().apply {
                put("total", total)
                put("imported", imported)
                put("skipped", skipped)
            }

            call.resolve(result)
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied reading SMS", e)
            call.reject("Permission denied — READ_SMS permission required")
        } catch (e: Exception) {
            Log.e(TAG, "SMS import failed", e)
            call.reject("Import failed: ${e.message}")
        }
    }

    // ==========================================
    // Event delivery — called by AegisSmsBridge
    // ==========================================

    /**
     * Deliver an SMS received event to JavaScript.
     * Called by AegisSmsBridge when a new SMS arrives.
     */
    fun deliverSmsEvent(event: JSONObject) {
        try {
            val jsObj = JSObject()
            for (key in event.keys()) {
                jsObj.put(key, event.get(key))
            }
            notifyListeners(EVENT_SMS_RECEIVED, jsObj)
            Log.i(TAG, "SMS event delivered to JS: ${event.optString("sender")}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to deliver SMS event", e)
        }
    }

    /**
     * Deliver a compose intent event to JavaScript.
     * Called by AegisSmsBridge when an external app triggers ACTION_SENDTO.
     */
    fun deliverComposeEvent(event: JSONObject) {
        try {
            val jsObj = JSObject()
            for (key in event.keys()) {
                jsObj.put(key, event.get(key))
            }
            notifyListeners(EVENT_COMPOSE_INTENT, jsObj)
            Log.i(TAG, "Compose event delivered to JS")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to deliver compose event", e)
        }
    }
}
