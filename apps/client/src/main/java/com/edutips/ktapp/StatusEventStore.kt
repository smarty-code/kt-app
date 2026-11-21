package com.edutips.ktapp

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

class StatusEventStore private constructor(
    context: Context,
) : SQLiteOpenHelper(context, "status_events.db", null, 1) {
    fun record(status: DeviceStatus, now: Long = System.currentTimeMillis()): Boolean {
        val payload = status.toJson().toString()
        val database = writableDatabase
        val latest = database.rawQuery(
            "SELECT payload, recorded_at FROM events ORDER BY recorded_at DESC LIMIT 1",
            null,
        )
        latest.use { cursor ->
            if (cursor.moveToFirst()) {
                val sameReading = cursor.getString(0) == payload
                val recent = now - cursor.getLong(1) < HEARTBEAT_MS
                if (sameReading && recent) return false
            }
        }
        database.insert(
            "events",
            null,
            ContentValues().apply {
                put("id", UUID.randomUUID().toString())
                put("recorded_at", now)
                put("payload", payload)
                put("sync_state", PENDING)
            },
        )
        return true
    }

    fun pending(limit: Int = 100): List<StoredEvent> {
        val database = readableDatabase
        val cursor = database.query(
            "events",
            arrayOf("id", "recorded_at", "payload"),
            "sync_state = ?",
            arrayOf(PENDING),
            null,
            null,
            "recorded_at ASC",
            limit.toString(),
        )
        return cursor.use {
            buildList {
                while (it.moveToNext()) {
                    add(StoredEvent(it.getString(0), it.getLong(1), it.getString(2)))
                }
            }
        }
    }

    fun pendingCount(): Int {
        val database = readableDatabase
        val cursor = database.rawQuery(
            "SELECT COUNT(*) FROM events WHERE sync_state = ?",
            arrayOf(PENDING),
        )
        return cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
    }

    fun markSent(ids: List<String>) {
        if (ids.isEmpty()) return
        val database = writableDatabase
        database.beginTransaction()
        try {
            val values = ContentValues().apply { put("sync_state", SENT) }
            ids.forEach { id ->
                database.update("events", values, "id = ?", arrayOf(id))
            }
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE events (
                id TEXT PRIMARY KEY,
                recorded_at INTEGER NOT NULL,
                payload TEXT NOT NULL,
                sync_state TEXT NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    data class StoredEvent(
        val id: String,
        val recordedAt: Long,
        val payload: String,
    )

    companion object {
        private const val PENDING = "pending"
        private const val SENT = "sent"
        private const val HEARTBEAT_MS = 120_000L

        @Volatile
        private var instance: StatusEventStore? = null

        fun get(context: Context): StatusEventStore {
            return instance ?: synchronized(this) {
                instance ?: StatusEventStore(context.applicationContext).also { instance = it }
            }
        }
    }
}
