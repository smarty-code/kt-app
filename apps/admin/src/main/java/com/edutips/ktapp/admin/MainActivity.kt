package com.edutips.ktapp.admin

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val refresh = object : Runnable {
        override fun run() {
            loadEvents()
            handler.postDelayed(this, 5_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
    }

    override fun onStart() {
        super.onStart()
        handler.post(refresh)
    }

    override fun onStop() {
        handler.removeCallbacks(refresh)
        super.onStop()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun loadEvents() {
        executor.execute {
            val text = try {
                fetchEvents()
            } catch (error: Exception) {
                "Could not reach the server.\n${error.message}\n${BuildConfig.SERVER_BASE_URL}"
            }
            runOnUiThread {
                if (!isDestroyed) {
                    findViewById<TextView>(R.id.events).text = text
                }
            }
        }
    }

    private fun fetchEvents(): String {
        val endpoint = BuildConfig.SERVER_BASE_URL.trimEnd('/') + "/api/events?limit=30"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
        }
        try {
            val code = connection.responseCode
            val body = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                .orEmpty()
            if (code !in 200..299) return "Server returned HTTP $code"
            return formatEvents(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun formatEvents(body: String): String {
        val events = JSONObject(body).getJSONArray("events")
        if (events.length() == 0) return "No device readings yet."
        val format = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.MEDIUM)
        return buildString {
            for (index in 0 until events.length()) {
                val event = events.getJSONObject(index)
                if (index > 0) appendLine().appendLine()
                val recordedAt = event.optLong("recordedAt")
                appendLine(format.format(Date(recordedAt)))
                appendLine("Device: ${if (event.optBoolean("devicePoweredOn")) "On" else "Off"}")
                appendLine("Screen: ${if (event.optBoolean("screenOn")) "On" else "Off"}")
                appendLine("Lock: ${if (event.optBoolean("unlocked")) "Unlocked" else "Locked"}")
                appendLine("Activity: ${activityLabel(event.optString("activity"))}")
                val using = if (event.isNull("foregroundApp")) "None" else event.optString("foregroundApp")
                appendLine("Using: $using")
                val battery = if (event.isNull("batteryPercent")) "Unknown" else "${event.optInt("batteryPercent")}%"
                appendLine("Battery: $battery")
                append("Battery state: ${event.optString("batteryState")}")
                append(notificationSummary(event))
            }
        }
    }

    private fun notificationSummary(event: JSONObject): String {
        if (!event.has("notifications") || event.isNull("notifications")) {
            return ""
        }
        val notifications = event.optJSONArray("notifications") ?: return ""
        if (notifications.length() == 0) return "\nNotifications: none"
        return buildString {
            append("\nNotifications:")
            for (index in 0 until notifications.length()) {
                val item = notifications.getJSONObject(index)
                appendLine()
                append(item.optString("app"))
                val title = item.optString("title")
                val text = item.optString("text")
                if (title.isNotBlank()) append(" — ").append(title)
                if (text.isNotBlank()) append("\n").append(text)
            }
        }
    }

    private fun activityLabel(activity: String): String = when (activity) {
        "IN_USE" -> "In use"
        "LOCK_SCREEN" -> "Lock screen"
        "IDLE" -> "Idle, screen off"
        else -> activity
    }
}
