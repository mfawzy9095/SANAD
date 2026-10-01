package com.sanad.v9test;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;

public final class BankNotificationStore {
    private static final String PREFS = "sanad_bank_notification_inbox_v1";
    private static final String KEY = "events";
    private static final int MAX_EVENTS = 200;
    private static final int MAX_TEXT = 4000;
    private static final long DEDUPE_WINDOW_MS = 15L * 60L * 1000L;

    private BankNotificationStore() {}

    public static synchronized boolean enqueue(
            Context context, String packageName, String title, String text, long postedAt) {
        if (context == null) return false;
        String safePackage = trim(packageName, 180);
        String safeTitle = trim(title, 300);
        String safeText = trim(text, MAX_TEXT);
        if (safeText.isEmpty()) return false;

        long ts = postedAt > 0L ? postedAt : System.currentTimeMillis();
        String fingerprint = sha256(safePackage + "\n" + safeTitle + "\n" + safeText);
        JSONArray current = read(context);

        for (int i = 0; i < current.length(); i++) {
            JSONObject old = current.optJSONObject(i);
            if (old == null) continue;
            if (!fingerprint.equals(old.optString("fingerprint", ""))) continue;
            long oldTs = old.optLong("postedAt", 0L);
            if (Math.abs(ts - oldTs) <= DEDUPE_WINDOW_MS) return false;
        }

        JSONArray next = new JSONArray();
        int start = Math.max(0, current.length() - (MAX_EVENTS - 1));
        for (int i = start; i < current.length(); i++) {
            JSONObject old = current.optJSONObject(i);
            if (old != null) next.put(old);
        }

        JSONObject event = new JSONObject();
        try {
            event.put("id", ts + "-" + fingerprint.substring(0, 16));
            event.put("packageName", safePackage);
            event.put("title", safeTitle);
            event.put("text", safeText);
            event.put("postedAt", ts);
            event.put("fingerprint", fingerprint);
        } catch (Exception e) {
            return false;
        }
        next.put(event);
        write(context, next);
        return true;
    }

    public static synchronized String getAllJson(Context context) {
        JSONArray source = read(context);
        JSONArray safe = new JSONArray();
        for (int i = 0; i < source.length(); i++) {
            JSONObject old = source.optJSONObject(i);
            if (old == null) continue;
            JSONObject out = new JSONObject();
            try {
                out.put("id", old.optString("id", ""));
                out.put("packageName", old.optString("packageName", ""));
                out.put("title", old.optString("title", ""));
                out.put("text", old.optString("text", ""));
                out.put("postedAt", old.optLong("postedAt", 0L));
                safe.put(out);
            } catch (Exception ignored) {}
        }
        return safe.toString();
    }

    public static synchronized void acknowledge(Context context, String jsonIds) {
        if (context == null || jsonIds == null) return;
        Set<String> ids = new HashSet<>();
        try {
            JSONArray arr = new JSONArray(jsonIds);
            for (int i = 0; i < arr.length(); i++) {
                String id = arr.optString(i, "");
                if (!id.isEmpty()) ids.add(id);
            }
        } catch (Exception ignored) {
            return;
        }
        if (ids.isEmpty()) return;

        JSONArray current = read(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject old = current.optJSONObject(i);
            if (old == null) continue;
            if (!ids.contains(old.optString("id", ""))) next.put(old);
        }
        write(context, next);
    }

    public static synchronized void clear(Context context) {
        if (context == null) return;
        prefs(context).edit().remove(KEY).apply();
    }

    private static JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static void write(Context context, JSONArray arr) {
        prefs(context).edit().putString(KEY, arr.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String trim(String value, int max) {
        String s = value == null ? "" : value.trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String sha256(String value) {
        try {
            MessageDigest d = MessageDigest.getInstance("SHA-256");
            byte[] out = d.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(out.length * 2);
            for (byte b : out) hex.append(String.format("%02x", b & 0xff));
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(value.hashCode()) + "0000000000000000";
        }
    }
}
