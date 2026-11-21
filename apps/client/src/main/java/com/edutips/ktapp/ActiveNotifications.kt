package com.edutips.ktapp

import android.content.Context
import android.content.pm.PackageManager
import android.service.notification.StatusBarNotification

data class PostedNotification(
    val app: String,
    val title: String,
    val text: String,
)

object ActiveNotifications {
    const val ACTION_CHANGED = "com.edutips.ktapp.NOTIFICATIONS_CHANGED"

    @Volatile
    var items: List<PostedNotification> = emptyList()
        private set

    fun replace(context: Context, notifications: List<StatusBarNotification>) {
        val packageManager = context.packageManager
        items = notifications
            .asSequence()
            .filter { it.packageName != context.packageName }
            .mapNotNull { notification -> notification.toPosted(packageManager) }
            .distinct()
            .toList()
    }

    fun displayLines(): List<String> = items.map { item ->
        if (item.text.isBlank()) {
            "${item.app} — ${item.title}"
        } else {
            "${item.app} — ${item.title}\n${item.text}"
        }
    }

    private fun StatusBarNotification.toPosted(packageManager: PackageManager): PostedNotification? {
        val extras = notification.extras
        val title = extras.getCharSequence("android.title")?.toString().orEmpty().trim()
        val text = extras.getCharSequence("android.bigText")?.toString()?.trim().orEmpty()
            .ifBlank { extras.getCharSequence("android.text")?.toString().orEmpty().trim() }
        if (title.isBlank() && text.isBlank()) return null
        val appName = try {
            val info = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(info).toString()
        } catch (_: PackageManager.NameNotFoundException) {
            packageName
        }
        return PostedNotification(app = appName, title = title, text = text)
    }
}
