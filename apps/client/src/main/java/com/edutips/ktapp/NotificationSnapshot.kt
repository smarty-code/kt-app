package com.edutips.ktapp

import android.content.Context
import android.content.pm.PackageManager
import android.service.notification.StatusBarNotification
import org.json.JSONObject

data class NotificationSnapshot(
    val slot: String,
    val appName: String,
    val title: String,
    val text: String,
    val subText: String,
    val postedAt: Long,
) {
    fun contentKey(): String = listOf(appName, title, text, subText).joinToString("\u0000")

    fun toJson(id: String, active: Boolean, removedAt: Long?, updatedAt: Long): JSONObject = JSONObject()
        .put("id", id)
        .put("appName", appName)
        .put("title", title)
        .put("text", text)
        .put("subText", subText)
        .put("postedAt", postedAt)
        .put("updatedAt", updatedAt)
        .put("active", active)
        .put("removedAt", removedAt ?: JSONObject.NULL)

    companion object {
        fun slotOf(notification: StatusBarNotification): String {
            return "${notification.packageName}|${notification.tag.orEmpty()}|${notification.id}"
        }

        fun capture(context: Context, notification: StatusBarNotification): NotificationSnapshot? {
            if (notification.packageName == context.packageName) return null
            val extras = notification.notification.extras
            val title = extras.getCharSequence("android.title")?.toString().orEmpty().trim().clip(TITLE_LIMIT)
            val text = messageText(extras).ifBlank {
                extras.getCharSequence("android.bigText")?.toString()?.trim().orEmpty()
                    .ifBlank { extras.getCharSequence("android.text")?.toString().orEmpty().trim() }
            }.clip(TEXT_LIMIT)
            val subText = extras.getCharSequence("android.subText")?.toString().orEmpty().trim().clip(SUBTEXT_LIMIT)
            if (title.isBlank() && text.isBlank() && subText.isBlank()) return null
            val postedAt = notification.postTime.takeIf { it > 0 } ?: System.currentTimeMillis()
            return NotificationSnapshot(
                slot = slotOf(notification),
                appName = appName(context, notification.packageName),
                title = title,
                text = text,
                subText = subText,
                postedAt = postedAt,
            )
        }

        private fun messageText(extras: android.os.Bundle): String {
            val raw = extras.getParcelableArray("android.messages") ?: return ""
            return raw.mapNotNull { item ->
                val bundle = item as? android.os.Bundle ?: return@mapNotNull null
                bundle.getCharSequence("text")?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            }.takeLast(5).joinToString("\n")
        }

        private fun appName(context: Context, packageName: String): String {
            val name = try {
                val info = context.packageManager.getApplicationInfo(packageName, 0)
                context.packageManager.getApplicationLabel(info).toString()
            } catch (_: PackageManager.NameNotFoundException) {
                packageName
            }
            return name.trim().clip(APP_LIMIT).ifBlank { packageName.clip(APP_LIMIT) }
        }

        private fun String.clip(max: Int): String = if (length <= max) this else take(max)

        private const val APP_LIMIT = 80
        private const val TITLE_LIMIT = 200
        private const val TEXT_LIMIT = 2000
        private const val SUBTEXT_LIMIT = 200
    }
}
