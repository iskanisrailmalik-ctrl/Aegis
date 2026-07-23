package com.aegis.sms

import android.app.Application
import android.util.Log

/**
 * Aegis Application class.
 *
 * Initializes the Capacitor framework and any app-level singletons.
 * This is referenced in AndroidManifest.xml as android:name=".AegisApplication".
 */
class AegisApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Aegis Application starting...")

        // Initialize the SMS bridge singleton
        AegisSmsBridge.initialize(this)
    }

    companion object {
        private const val TAG = "AegisApp"
    }
}
