package com.edutips.ktapp

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

class NotificationLogStore private constructor(
    context: Context,
) : SQLiteOpenHelper(context, "notification_log.db", null, 2) {
    fun save(snapshot: NotificationSnapshot, now: Long): Boolean {
        synchronized(this) {
            val database = writableDatabase
            val existing = readActive(database, snapshot.slot)
            if (existing != null) {
                if (existing.content == snapshot.contentKey()) return false
                write(database, existing.id, snapshot, active = true, removedAt = null, now = now)
                return true
            }
            write(database, newAppearanceId(snapshot.slot, now), snapshot, active = true, removedAt = null, now = now)
            return true
        }
    }

    fun markInactive(slot: String, now: Long): Boolean {
        synchronized(this) {
            val database = writableDatabase
            val existing = readActive(database, slot) ?: return false
            val updated = JSONObject(existing.payload)
                .put("active", false)
                .put("removedAt", now)
                .put("updatedAt", now)
            database.update(
                "notifications",
                ContentValues().apply {
                    put("updated_at", now)
                    put("active", 0)
                    put("payload", updated.toString())
                    put("sync_state", PENDING)
                },
                "id = ?",
                arrayOf(existing.id),
            )
            return true
        }
    }

    fun pending(limit: Int = 50): List<StoredNotification> {
        val cursor = readableDatabase.query(
            "notifications",
            arrayOf("id", "payload"),
            "sync_state = ?",
            arrayOf(PENDING),
            null,
            null,
            "updated_at ASC",
            limit.toString(),
        )
        return cursor.use {
            buildList {
                while (it.moveToNext()) {
                    add(StoredNotification(it.getString(0), it.getString(1)))
                }
            }
        }
    }

    fun pendingCount(): Int {
        val cursor = readableDatabase.rawQuery(
            "SELECT COUNT(*) FROM notifications WHERE sync_state = ?",
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
                database.update("notifications", values, "id = ?", arrayOf(id))
            }
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE notifications (
                id TEXT PRIMARY KEY,
                slot TEXT NOT NULL,
                posted_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                content TEXT NOT NULL,
                active INTEGER NOT NULL,
                payload TEXT NOT NULL,
                sync_state TEXT NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE notifications ADD COLUMN slot TEXT NOT NULL DEFAULT ''")
        }
    }

    private fun write(
        database: SQLiteDatabase,
        id: String,
        snapshot: NotificationSnapshot,
        active: Boolean,
        removedAt: Long?,
        now: Long,
    ) {
        val values = ContentValues().apply {
            put("id", id)
            put("slot", snapshot.slot)
            put("posted_at", snapshot.postedAt)
            put("updated_at", now)
            put("content", snapshot.contentKey())
            put("active", if (active) 1 else 0)
            put("payload", snapshot.toJson(id, active, removedAt, now).toString())
            put("sync_state", PENDING)
        }
        val updated = database.update("notifications", values, "id = ?", arrayOf(id))
        if (updated == 0) {
            database.insert("notifications", null, values)
        }
    }

    private fun readActive(database: SQLiteDatabase, slot: String): ActiveRow? {
        val cursor = database.query(
            "notifications",
            arrayOf("id", "content", "payload"),
            "slot = ? AND active = 1",
            arrayOf(slot),
            null,
            null,
            "updated_at DESC",
            "1",
        )
        return cursor.use {
            if (!it.moveToFirst()) return null
            ActiveRow(it.getString(0), it.getString(1), it.getString(2))
        }
    }

    private fun newAppearanceId(slot: String, now: Long): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest("$slot|$now".toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { byte -> "%02x".format(byte) }.substring(0, 32)
    }

    private data class ActiveRow(
        val id: String,
        val content: String,
        val payload: String,
    )

    data class StoredNotification(
        val id: String,
        val payload: String,
    )

    companion object {
        private const val PENDING = "pending"
        private const val SENT = "sent"

        @Volatile
        private var instance: NotificationLogStore? = null

        fun get(context: Context): NotificationLogStore {
            return instance ?: synchronized(this) {
                instance ?: NotificationLogStore(context.applicationContext).also { instance = it }
            }
        }
    }
}
