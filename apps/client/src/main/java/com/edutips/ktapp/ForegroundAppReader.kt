package com.edutips.ktapp

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Process

object ForegroundAppReader {
    fun hasAccess(context: Context): Boolean {
        val appOps = context.getSystemService(AppOpsManager::class.java)
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName,
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun currentLabel(context: Context): String? = current(context)?.appName

    fun current(context: Context): ObservedApp? {
        val packageName = currentPackage(context) ?: return null
        return ObservedApp(packageName = packageName, appName = label(context, packageName))
    }

    data class ObservedApp(
        val packageName: String,
        val appName: String,
    )

    private fun label(context: Context, packageName: String): String {
        return try {
            val info = context.packageManager.getApplicationInfo(packageName, 0)
            context.packageManager.getApplicationLabel(info).toString()
        } catch (_: PackageManager.NameNotFoundException) {
            packageName
        }
    }

    private fun currentPackage(context: Context): String? {
        if (!hasAccess(context)) return null
        val usage = context.getSystemService(UsageStatsManager::class.java)
        val now = System.currentTimeMillis()
        val events = usage.queryEvents(now - LOOKBACK_MS, now)
        val event = UsageEvents.Event()
        var packageName: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                packageName = event.packageName
            }
        }
        if (packageName != null) return packageName
        return usage.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - LOOKBACK_MS, now)
            ?.maxByOrNull { it.lastTimeUsed }
            ?.packageName
    }

    private const val LOOKBACK_MS = 5 * 60_000L
}
