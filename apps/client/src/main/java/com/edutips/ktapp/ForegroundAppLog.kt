package com.edutips.ktapp

import android.content.Context

object ForegroundAppLog {
    fun record(context: Context, status: DeviceStatus) {
        val observed = if (status.screenOn) ForegroundAppReader.current(context) else null
        val saved = ForegroundAppLogStore.get(context).record(
            packageName = observed?.packageName.orEmpty(),
            appName = observed?.appName ?: if (status.screenOn) "Unknown" else "None",
        )
        if (saved) ForegroundAppSyncWorker.enqueue(context)
    }
}
