package com.edutips.ktapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Settings
import android.view.View
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private val refreshSync = object : Runnable {
        override fun run() {
            showStatus()
            handler.postDelayed(this, 1_000)
        }
    }
    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == ActiveNotifications.ACTION_CHANGED) {
                showNotifications()
            } else {
                showStatus()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        findViewById<View>(R.id.notification_access).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        findViewById<View>(R.id.usage_access).setOnClickListener {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }
    }

    override fun onStart() {
        super.onStart()
        ContextCompat.registerReceiver(
            this,
            statusReceiver,
            statusChanges(),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        showStatus()
        showNotifications()
        handler.post(refreshSync)
    }

    override fun onStop() {
        handler.removeCallbacks(refreshSync)
        unregisterReceiver(statusReceiver)
        super.onStop()
    }

    private fun showStatus() {
        val status = DeviceStatusReader.read(this)
        val usageAccess = ForegroundAppReader.hasAccess(this)
        findViewById<TextView>(R.id.device_status).text = status.toDisplayText(usageAccess)
        findViewById<View>(R.id.usage_access).visibility = if (usageAccess) View.GONE else View.VISIBLE
        if (StatusEventStore.get(this).record(status)) {
            Log.i(TAG, status.toDisplayText(usageAccess))
            StatusSyncWorker.enqueue(this)
        }
        ForegroundAppLog.record(this, status)
        showSync()
    }

    private fun showSync() {
        val pending = StatusEventStore.get(this).pendingCount()
        val message = if (pending == 0) {
            "Sync: nothing waiting"
        } else {
            "Sync: $pending waiting for a connection"
        }
        findViewById<TextView>(R.id.sync_status).text = "$message\n${BuildConfig.SERVER_BASE_URL}"
    }

    private fun statusChanges(): IntentFilter = IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_SCREEN_OFF)
        addAction(Intent.ACTION_USER_PRESENT)
        addAction(Intent.ACTION_BATTERY_CHANGED)
        addAction(Intent.ACTION_POWER_CONNECTED)
        addAction(Intent.ACTION_POWER_DISCONNECTED)
        addAction(ActiveNotifications.ACTION_CHANGED)
    }

    private fun showNotifications() {
        val enabled = ClientNotificationListener.isEnabled(this)
        findViewById<View>(R.id.notification_access).visibility = if (enabled) View.GONE else View.VISIBLE
        if (enabled) {
            ClientNotificationListener.requestRebind(this)
        }
        val lines = ActiveNotifications.displayLines()
        findViewById<TextView>(R.id.notifications).text = when {
            !enabled -> getString(R.string.notifications_waiting)
            lines.isEmpty() -> getString(R.string.notifications_empty)
            else -> lines.joinToString("\n\n")
        }
    }

    private companion object {
        const val TAG = "DeviceStatus"
    }
}
