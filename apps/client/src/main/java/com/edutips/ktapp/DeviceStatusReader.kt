package com.edutips.ktapp

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.PowerManager

object DeviceStatusReader {
    fun read(context: Context): DeviceStatus {
        val powerManager = context.getSystemService(PowerManager::class.java)
        val keyguardManager = context.getSystemService(KeyguardManager::class.java)
        val screenOn = powerManager.isInteractive
        val locked = keyguardManager.isKeyguardLocked
        val activity = when {
            !screenOn -> DeviceActivity.IDLE
            locked -> DeviceActivity.LOCK_SCREEN
            else -> DeviceActivity.IN_USE
        }
        val battery = readBattery(context)
        val foregroundApp = if (screenOn) ForegroundAppReader.currentLabel(context) else null

        return DeviceStatus(
            devicePoweredOn = true,
            screenOn = screenOn,
            unlocked = !locked,
            activity = activity,
            batteryPercent = battery.percent,
            batteryState = battery.state,
            foregroundApp = foregroundApp,
            notifications = ActiveNotifications.items,
        )
    }

    private fun readBattery(context: Context): BatteryReading {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            ?: return BatteryReading(percent = null, state = "Unknown")
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val percent = if (level >= 0 && scale > 0) (level * 100) / scale else null
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
        val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)

        return BatteryReading(percent = percent, state = batteryState(status, plugged))
    }

    private fun batteryState(status: Int, plugged: Int): String {
        val source = when (plugged) {
            BatteryManager.BATTERY_PLUGGED_USB -> "USB"
            BatteryManager.BATTERY_PLUGGED_AC -> "AC"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless"
            else -> null
        }
        return when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING -> source?.let { "Charging · $it" } ?: "Charging"
            BatteryManager.BATTERY_STATUS_FULL -> "Full"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "Discharging"
            BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "Not charging"
            else -> "Unknown"
        }
    }

    private data class BatteryReading(
        val percent: Int?,
        val state: String,
    )
}
