package com.edutips.ktapp

import org.json.JSONArray
import org.json.JSONObject

enum class DeviceActivity {
    IN_USE,
    LOCK_SCREEN,
    IDLE,
}

data class DeviceStatus(
    val devicePoweredOn: Boolean,
    val screenOn: Boolean,
    val unlocked: Boolean,
    val activity: DeviceActivity,
    val batteryPercent: Int?,
    val batteryState: String,
    val foregroundApp: String?,
    val notifications: List<PostedNotification> = emptyList(),
) {
    fun toDisplayText(usageAccess: Boolean = true): String = buildString {
        val using = when {
            !screenOn -> "None"
            foregroundApp != null -> foregroundApp
            !usageAccess -> "Allow usage access"
            else -> "Unknown"
        }
        appendLine("Device: ${if (devicePoweredOn) "On" else "Off"}")
        appendLine("Screen: ${if (screenOn) "On" else "Off"}")
        appendLine("Lock: ${if (unlocked) "Unlocked" else "Locked"}")
        appendLine("Activity: ${activity.label()}")
        appendLine("Using: $using")
        appendLine("Battery: ${batteryPercent?.let { "$it%" } ?: "Unknown"}")
        append("Battery state: $batteryState")
    }

    fun toJson(): JSONObject = JSONObject()
        .put("devicePoweredOn", devicePoweredOn)
        .put("screenOn", screenOn)
        .put("unlocked", unlocked)
        .put("activity", activity.name)
        .put("batteryPercent", batteryPercent ?: JSONObject.NULL)
        .put("batteryState", batteryState)
        .put("foregroundApp", foregroundApp ?: JSONObject.NULL)
        .put(
            "notifications",
            JSONArray().apply {
                notifications.forEach { item ->
                    put(
                        JSONObject()
                            .put("app", item.app)
                            .put("title", item.title)
                            .put("text", item.text),
                    )
                }
            },
        )

    private fun DeviceActivity.label(): String = when (this) {
        DeviceActivity.IN_USE -> "In use"
        DeviceActivity.LOCK_SCREEN -> "Lock screen"
        DeviceActivity.IDLE -> "Idle, screen off"
    }
}
