package com.sanad.full;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Uploads only the recorded utterance, when the user configured a personal Groq key. */
final class GroqVoiceTranscriber {
    private static final String ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
    private final Context context;

    GroqVoiceTranscriber(Context context) { this.context = context.getApplicationContext(); }

    boolean canTryCloud() {
        if (!VoiceCloudSettings.isConfigured(context)) return false;
        ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null || manager.getActiveNetwork() == null) return false;
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(manager.getActiveNetwork());
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    String transcribe(byte[] pcm, int sampleRate, String language) throws Exception {
        String key = VoiceCloudSettings.getKey(context);
        if (key == null) throw new IllegalStateException("cloud key missing");
        byte[] wav = VoiceWav.encode(pcm, sampleRate);
        String boundary = "sanad-" + UUID.randomUUID();
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(18000);
            connection.setInstanceFollowRedirects(false);
            connection.setDoOutput(true);
            connection.setChunkedStreamingMode(16384);
            connection.setRequestProperty("Authorization", "Bearer " + key);
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            try (OutputStream output = connection.getOutputStream()) {
                field(output, boundary, "model", "whisper-large-v3");
                field(output, boundary, "language", "en".equals(language) ? "en" : "ar");
                field(output, boundary, "response_format", "json");
                output.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"sanad.wav\"\r\nContent-Type: audio/wav\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                output.write(wav);
                output.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            }
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK)
                throw new IllegalStateException("cloud HTTP " + connection.getResponseCode());
            try (InputStream response = connection.getInputStream()) {
                ByteArrayOutputStream body = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int read;
                while ((read = response.read(buffer)) != -1) {
                    if (body.size() + read > 65536) throw new IllegalStateException("cloud response too large");
                    body.write(buffer, 0, read);
                }
                String text = new JSONObject(body.toString("UTF-8")).optString("text", "").replaceAll("\\s+", " ").trim();
                if (text.isEmpty()) throw new IllegalStateException("cloud response empty");
                return text;
            }
        } finally {
            connection.disconnect();
        }
    }

    private static void field(OutputStream output, String boundary, String name, String value) throws Exception {
        output.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n")
                .getBytes(StandardCharsets.UTF_8));
    }

}
