package com.edutips.ktapp

import android.content.Context
import java.util.UUID

object DeviceId {
    fun get(context: Context): String {
        val preferences = context.applicationContext.getSharedPreferences("device", Context.MODE_PRIVATE)
        preferences.getString(KEY, null)?.let { return it }
        val created = UUID.randomUUID().toString()
        preferences.edit().putString(KEY, created).apply()
        return created
    }

    private const val KEY = "id"
}
