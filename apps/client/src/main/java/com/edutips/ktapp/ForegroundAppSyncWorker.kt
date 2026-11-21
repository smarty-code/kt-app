package com.edutips.ktapp

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.IOException
import java.util.concurrent.TimeUnit

class ForegroundAppSyncWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {
    override fun doWork(): Result {
        val store = ForegroundAppLogStore.get(applicationContext)
        while (true) {
            val batch = store.pending()
            if (batch.isEmpty()) return Result.success()
            val accepted = try {
                ForegroundAppUploader.upload(applicationContext, batch)
            } catch (_: IOException) {
                return Result.retry()
            }
            if (accepted.isEmpty()) return Result.retry()
            store.markSent(accepted)
        }
    }

    companion object {
        private const val WORK_NAME = "sync-foreground-apps"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<ForegroundAppSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
