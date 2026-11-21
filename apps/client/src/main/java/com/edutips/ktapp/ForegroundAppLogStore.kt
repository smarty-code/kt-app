package com.edutips.ktapp

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject
import java.util.UUID

class ForegroundAppLogStore private constructor(
    context: Context,
) : SQLiteOpenHelper(context, "foreground_apps.db", null, 1) {
    fun record(packageName: String, appName: String, collectedAt: Long = System.currentTimeMillis()): Boolean {
        synchronized(this) {
            val database = writableDatabase
            val latest = database.rawQuery(
                "SELECT package_name, app_name, collected_at FROM foreground_apps ORDER BY collected_at DESC LIMIT 1",
                null,
            )
            latest.use { cursor ->
                if (cursor.moveToFirst()) {
                    val sameApp = cursor.getString(0) == packageName && cursor.getString(1) == appName
                    val recent = collectedAt - cursor.getLong(2) < SAMPLE_GAP_MS
                    if (sameApp && recent) return false
                }
            }
            val id = UUID.randomUUID().toString()
            database.insert(
                "foreground_apps",
                null,
                ContentValues().apply {
                    put("id", id)
                    put("collected_at", collectedAt)
                    put("package_name", packageName)
                    put("app_name", appName)
                    put(
                        "payload",
                        JSONObject()
                            .put("id", id)
                            .put("packageName", packageName)
                            .put("appName", appName)
                            .put("collectedAt", collectedAt)
                            .toString(),
                    )
                    put("sync_state", PENDING)
                },
            )
            return true
        }
    }

    fun pending(limit: Int = 50): List<StoredForegroundApp> {
        val cursor = readableDatabase.query(
            "foreground_apps",
            arrayOf("id", "payload"),
            "sync_state = ?",
            arrayOf(PENDING),
            null,
            null,
            "collected_at ASC",
            limit.toString(),
        )
        return cursor.use {
            buildList {
                while (it.moveToNext()) {
                    add(StoredForegroundApp(it.getString(0), it.getString(1)))
                }
            }
        }
    }

    fun markSent(ids: List<String>) {
        if (ids.isEmpty()) return
        val database = writableDatabase
        database.beginTransaction()
        try {
            val values = ContentValues().apply { put("sync_state", SENT) }
            ids.forEach { id ->
                database.update("foreground_apps", values, "id = ?", arrayOf(id))
            }
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE foreground_apps (
                id TEXT PRIMARY KEY,
                collected_at INTEGER NOT NULL,
                package_name TEXT NOT NULL,
                app_name TEXT NOT NULL,
                payload TEXT NOT NULL,
                sync_state TEXT NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    data class StoredForegroundApp(
        val id: String,
        val payload: String,
    )

    companion object {
        private const val PENDING = "pending"
        private const val SENT = "sent"
        private const val SAMPLE_GAP_MS = 60_000L

        @Volatile
        private var instance: ForegroundAppLogStore? = null

        fun get(context: Context): ForegroundAppLogStore {
            return instance ?: synchronized(this) {
                instance ?: ForegroundAppLogStore(context.applicationContext).also { instance = it }
            }
        }
    }
}
