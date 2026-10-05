package com.sanad.v9test;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class BankNotificationStore {
    private static final String PREFS = "sanad_bank_notification_inbox_v1";
    private static final String KEY = "events";
    private static final String KEY_CAPTURED_TOTAL = "captured_total";
    private static final String KEY_LAST_CAPTURED_AT = "last_captured_at";
    private static final String KEY_LAST_PACKAGE = "last_package";
    private static final String KEY_LAST_TITLE = "last_title";
    private static final int MAX_EVENTS = 200;
    private static final int OVERFLOW_EVENTS = 2000;
    private static volatile long captureFailuresInProcess;
    private static final int MAX_TEXT = 4000;
    private static final Pattern PAN_CANDIDATE =
            Pattern.compile("(?<!\\d)(?:\\d[ -]?){12,18}\\d(?!\\d)");

    private BankNotificationStore() {}

    public static final int ADDED = 1;
    public static final int DUPLICATE = 0;
    public static final int FULL = -1;
    public static final int ERROR = -2;

    public static synchronized boolean enqueue(
            Context context, String packageName, String title, String text, long postedAt) {
        return enqueueStatus(context, packageName, title, text, postedAt) == ADDED;
    }

    public static synchronized int enqueueStatus(
            Context context, String packageName, String title, String text, long postedAt) {
        if (context == null) return ERROR;
        String safePackage = trim(packageName, 180);
        String safeTitle = trim(redactSensitiveCardNumbers(title), 300);
        String safeText = trim(redactSensitiveCardNumbers(text), MAX_TEXT);
        if (safeText.isEmpty()) return ERROR;

        long ts = postedAt > 0L ? postedAt : System.currentTimeMillis();
        String fingerprint = sha256(safePackage + "\n" + safeTitle + "\n" + safeText);
        String contentFingerprint = sha256(safeText.replaceAll("\\s+", " ").trim());
        JSONArray current;
        try { current = read(context); }
        catch (IllegalStateException corrupt) {
            recordCaptureFailure(context, "INBOX_CORRUPT", ts);
            return ERROR;
        }

        for (int i = 0; i < current.length(); i++) {
            JSONObject old = current.optJSONObject(i);
            if (old == null) continue;
            long oldTs = old.optLong("postedAt", 0L);
            if (fingerprint.equals(old.optString("fingerprint", "")) &&
                    ts == oldTs) return DUPLICATE;

        }

        // Preserve the first bounded queue and use explicit overflow headroom.
        // Never evict a financial notification to admit a newer one.
        if (!queueCanAccept(current.length())) {
            recordCaptureFailure(context, "FULL", ts);
            return FULL;
        }
        JSONArray next = new JSONArray();
        int start = 0;
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
            event.put("truncated", (text == null ? "" : text).length() > MAX_TEXT);
            event.put("postedAt", ts);
            event.put("fingerprint", fingerprint);
            event.put("contentFingerprint", contentFingerprint);
        } catch (Exception e) {
            return ERROR;
        }
        next.put(event);
        if (!write(context, next)) { recordCaptureFailure(context, "WRITE_FAILED", ts); return ERROR; }
        SharedPreferences p = prefs(context);
        p.edit()
                .putLong(KEY_CAPTURED_TOTAL, p.getLong(KEY_CAPTURED_TOTAL, 0L) + 1L)
                .putLong(KEY_LAST_CAPTURED_AT, ts)
                .putString(KEY_LAST_PACKAGE, safePackage)
                .putString(KEY_LAST_TITLE, safeTitle)
                .apply();
        return ADDED;
    }

    private static void recordCaptureFailure(Context context, String reason, long at) {
        captureFailuresInProcess++;
        SharedPreferences p = prefs(context);
        p.edit().putLong("capture_failures", p.getLong("capture_failures", 0L) + 1L)
                .putString("last_capture_failure", reason).putLong("last_capture_failure_at", at).commit();
    }

    // Produces the exact same stable event identity as enqueueStatus, without
    // writing to the bounded notification queue. Used by explicit SMS scans.
    public static JSONObject smsEvent(String address, String body, long postedAt) {
        String safePackage = trim("sms:" + (address == null ? "" : address.trim()), 180);
        String safeTitle = trim(redactSensitiveCardNumbers(address), 300);
        String safeText = trim(redactSensitiveCardNumbers(body), MAX_TEXT);
        if (safeText.isEmpty()) return null;
        long ts = postedAt > 0L ? postedAt : System.currentTimeMillis();
        String fingerprint = sha256(safePackage + "\n" + safeTitle + "\n" + safeText);
        JSONObject event = new JSONObject();
        try {
            event.put("id", ts + "-" + fingerprint.substring(0, 16));
            event.put("packageName", safePackage);
            event.put("title", safeTitle);
            event.put("text", safeText);
            event.put("truncated", (body == null ? "" : body).length() > MAX_TEXT);
            event.put("postedAt", ts);
            return event;
        } catch (Exception error) { return null; }
    }

    public static synchronized String getAllJson(Context context) {
        JSONArray source;
        try { source = read(context); }
        catch (IllegalStateException corrupt) { return "{\"error\":\"inbox-corrupt\"}"; }
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
                out.put("truncated", old.optBoolean("truncated", false));
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

        JSONArray current;
        try { current = read(context); }
        catch (IllegalStateException corrupt) { return; }
        JSONArray next = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject old = current.optJSONObject(i);
            if (old == null) continue;
            if (!ids.contains(old.optString("id", ""))) next.put(old);
        }
        write(context, next);
    }

    public static synchronized String getDiagnosticsJson(Context context) {
        JSONObject out = new JSONObject();
        if (context == null) return out.toString();
        try {
            SharedPreferences p = prefs(context);
            int count;
            try { count = read(context).length(); out.put("queueCorrupt", false); }
            catch (IllegalStateException corrupt) { count = -1; out.put("queueCorrupt", true); }
            out.put("pendingCount", count);
            out.put("queueCapacity", MAX_EVENTS + OVERFLOW_EVENTS);
            out.put("overflowPending", Math.max(0, count - MAX_EVENTS));
            out.put("captureFailures", p.getLong("capture_failures", 0L));
            out.put("captureFailuresInProcess", captureFailuresInProcess);
            out.put("lastCaptureFailure", p.getString("last_capture_failure", ""));
            out.put("lastCaptureFailureAt", p.getLong("last_capture_failure_at", 0L));
            out.put("recoveryRequired", count < 0 || count > MAX_EVENTS || p.getLong("capture_failures", 0L) > 0L || captureFailuresInProcess > 0L);
            out.put("capturedTotal", p.getLong(KEY_CAPTURED_TOTAL, 0L));
            out.put("lastCapturedAt", p.getLong(KEY_LAST_CAPTURED_AT, 0L));
            out.put("lastPackage", p.getString(KEY_LAST_PACKAGE, ""));
            out.put("lastTitle", p.getString(KEY_LAST_TITLE, ""));
        } catch (Exception ignored) {}
        return out.toString();
    }

    public static synchronized boolean clear(Context context) {
        if (context == null) return false;
        boolean committed = prefs(context).edit().clear().commit();
        return committed && read(context).length() == 0;
    }

    private static JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw == null ? "[]" : raw);
            boolean changed = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject event = arr.optJSONObject(i);
                if (event == null) continue;
                String oldTitle = event.optString("title", "");
                String oldText = event.optString("text", "");
                String safeTitle = redactSensitiveCardNumbers(oldTitle);
                String safeText = redactSensitiveCardNumbers(oldText);
                if (!safeTitle.equals(oldTitle)) {
                    event.put("title", safeTitle);
                    changed = true;
                }
                if (!safeText.equals(oldText)) {
                    event.put("text", safeText);
                    changed = true;
                }
            }
            if (changed) prefs(context).edit().putString(KEY, arr.toString()).apply();
            return arr;
        } catch (Exception ignored) {
            throw new IllegalStateException("inbox-corrupt: original bytes preserved", ignored);
        }
    }

    static boolean queueCanAccept(int count) { return count >= 0 && count < MAX_EVENTS + OVERFLOW_EVENTS; }

    static boolean capacityReached(int count) { return count >= MAX_EVENTS; }

    private static boolean write(Context context, JSONArray arr) {
        return prefs(context).edit().putString(KEY, arr.toString()).commit();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String redactSensitiveCardNumbers(String value) {
        String input = value == null ? "" : value;
        Matcher matcher = PAN_CANDIDATE.matcher(input);
        StringBuffer out = new StringBuffer(input.length());
        while (matcher.find()) {
            String candidate = matcher.group();
            String digits = candidate.replaceAll("\\D", "");
            if (digits.length() < 13 || digits.length() > 19 || !passesLuhn(digits)) continue;
            String masked = digits.substring(0, 4) + " XXXX XXXX " +
                    digits.substring(digits.length() - 4);
            matcher.appendReplacement(out, Matcher.quoteReplacement(masked));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static boolean passesLuhn(String digits) {
        int sum = 0;
        boolean doubleDigit = false;
        for (int i = digits.length() - 1; i >= 0; i--) {
            int d = digits.charAt(i) - '0';
            if (d < 0 || d > 9) return false;
            if (doubleDigit) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
            doubleDigit = !doubleDigit;
        }
        return sum % 10 == 0;
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

