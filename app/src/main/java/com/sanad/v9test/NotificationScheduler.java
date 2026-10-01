package com.sanad.v9test;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public final class NotificationScheduler {
    private static final String CHANNEL_ID = "sanad_reminders";
    private static final String PREFS = "sanad_native";
    private static final String KEY_REMINDERS = "reminders_json";

    private NotificationScheduler() {}

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "SANAD reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Recurring payment and income reminders");
            nm.createNotificationChannel(channel);
        }
    }

    public static void scheduleAll(Context context, String json) {
        if (json == null) json = "[]";
        cancelScheduled(context, readStored(context));
        writeStored(context, json);
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject spec = arr.optJSONObject(i);
                if (spec != null) scheduleSpec(context, spec);
            }
        } catch (Exception ignored) {}
    }

    public static void cancelAll(Context context) {
        cancelScheduled(context, readStored(context));
        writeStored(context, "[]");
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
    }

    public static void rescheduleStored(Context context) {
        ensureChannel(context);
        String json = readStored(context);
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject spec = arr.optJSONObject(i);
                if (spec != null) scheduleSpec(context, spec);
            }
        } catch (Exception ignored) {}
    }

    static void scheduleNextFromJson(Context context, String specJson) {
        try {
            JSONObject spec = new JSONObject(specJson);
            scheduleSpec(context, spec);
        } catch (Exception ignored) {}
    }

    private static void scheduleSpec(Context context, JSONObject spec) {
        String id = spec.optString("id", "");
        if (id.isEmpty()) return;
        int day = Math.max(1, Math.min(28, spec.optInt("day", 1)));
        int reminderDays = Math.max(0, Math.min(30, spec.optInt("reminderDays", 3)));
        int month = Math.max(0, Math.min(11, spec.optInt("month", 0)));
        String frequency = spec.optString("frequency", "monthly");
        long when = NotificationTimeCalculator.nextTrigger(
                System.currentTimeMillis(),
                day,
                month,
                reminderDays,
                frequency
        );
        if (when <= System.currentTimeMillis()) return;

        Intent intent = new Intent(context, NotificationReceiver.class);
        intent.setAction("com.sanad.v9test.REMINDER." + id);
        intent.putExtra("spec", spec.toString());

        PendingIntent pi = PendingIntent.getBroadcast(
                context,
                requestCode(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
    }

    public static void showNow(Context context, String id, String title, String body) {
        ensureChannel(context);
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title == null ? "SANAD" : title)
                .setContentText(body == null ? "" : body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body == null ? "" : body))
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_REMINDER);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(requestCode(id == null ? "sanad" : id), builder.build());
    }

    private static void cancelScheduled(Context context, String json) {
        try {
            JSONArray arr = new JSONArray(json == null ? "[]" : json);
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject spec = arr.optJSONObject(i);
                if (spec == null) continue;
                String id = spec.optString("id", "");
                if (id.isEmpty()) continue;
                Intent intent = new Intent(context, NotificationReceiver.class);
                intent.setAction("com.sanad.v9test.REMINDER." + id);
                PendingIntent pi = PendingIntent.getBroadcast(
                        context,
                        requestCode(id),
                        intent,
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        } catch (Exception ignored) {}
    }

    private static int requestCode(String id) {
        return 0x3fffffff & id.hashCode();
    }

    private static String readStored(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return p.getString(KEY_REMINDERS, "[]");
    }

    private static void writeStored(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_REMINDERS, json)
                .apply();
    }
}
