package com.sanad.full;

import android.content.Context;
import android.content.SharedPreferences;

/** The user's personal Groq key stays in Android's private, encrypted storage. */
final class VoiceCloudSettings {
    private static final String PREFS = "sanad_voice_cloud";
    private static final String KEY = "groq_key_encrypted";

    private VoiceCloudSettings() {}

    static boolean isConfigured(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).contains(KEY);
    }

    static String getKey(Context context) throws Exception {
        String encrypted = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        if (encrypted == null) return null;
        String key = CryptoStore.decrypt(encrypted);
        if (key == null || key.trim().isEmpty()) throw new IllegalStateException("invalid voice key");
        return key;
    }

    static void setKey(Context context, String value) throws Exception {
        String key = value == null ? "" : value.trim();
        if (!key.startsWith("gsk_") || key.length() < 20 || key.length() > 256)
            throw new IllegalArgumentException("invalid Groq key");
        String encrypted = CryptoStore.encrypt(key);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.edit().putString(KEY, encrypted).commit())
            throw new IllegalStateException("voice key was not saved");
    }

    static void clear(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply();
    }
}
