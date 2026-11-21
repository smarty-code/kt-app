package com.edutips.ktapp

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.util.UUID

object DeviceId {
    fun get(context: Context): String {
        val preferences = context.applicationContext.getSharedPreferences("device", Context.MODE_PRIVATE)
        preferences.getString(KEY, null)?.let { return it }
        val created = UUID.randomUUID().toString()
        preferences.edit().putString(KEY, created).apply()
        return created
    }

    fun name(context: Context): String {
        val settingsName = readSettingsName(context)
        if (!settingsName.isNullOrBlank()) return settingsName.trim().take(NAME_LIMIT)
        val manufacturer = Build.MANUFACTURER.trim()
        val model = Build.MODEL.trim()
        val label = when {
            model.isBlank() -> manufacturer
            manufacturer.isBlank() || model.startsWith(manufacturer, ignoreCase = true) -> model
            else -> "$manufacturer $model"
        }
        return label.ifBlank { "Android" }.take(NAME_LIMIT)
    }

    private fun readSettingsName(context: Context): String? {
        return try {
            val resolver = context.contentResolver
            val global = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
                Settings.Global.getString(resolver, Settings.Global.DEVICE_NAME)
            } else {
                null
            }
            global?.takeIf { it.isNotBlank() }
                ?: Settings.Secure.getString(resolver, "bluetooth_name")
        } catch (_: SecurityException) {
            null
        }
    }

    private const val KEY = "id"
    private const val NAME_LIMIT = 80
}
