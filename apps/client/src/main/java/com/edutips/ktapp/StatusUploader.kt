package com.edutips.ktapp

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object StatusUploader {
    fun upload(context: Context, events: List<StatusEventStore.StoredEvent>): List<String> {
        if (events.isEmpty()) return emptyList()
        val body = JSONObject()
            .put("deviceId", DeviceId.get(context))
            .put(
                "events",
                JSONArray().apply {
                    events.forEach { event ->
                        put(
                            JSONObject(event.payload)
                                .put("id", event.id)
                                .put("recordedAt", event.recordedAt),
                        )
                    }
                },
            )
        val endpoint = BuildConfig.SERVER_BASE_URL.trimEnd('/') + "/api/events"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 20_000
            setRequestProperty("Content-Type", "application/json")
        }
        try {
            connection.outputStream.use { stream ->
                stream.write(body.toString().toByteArray(Charsets.UTF_8))
            }
            val code = connection.responseCode
            val response = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                .orEmpty()
            if (code !in 200..299) {
                throw IOException("Upload failed with HTTP $code")
            }
            val accepted = JSONObject(response).getJSONArray("accepted")
            return List(accepted.length()) { index -> accepted.getString(index) }
        } finally {
            connection.disconnect()
        }
    }
}
