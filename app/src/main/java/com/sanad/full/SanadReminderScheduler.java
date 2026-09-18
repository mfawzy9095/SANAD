package com.sanad.full;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Calendar;

public final class SanadReminderScheduler {
    public static final String ACTION_DAILY = "com.sanad.full.DAILY_FINANCE_CHECK";
    public static final String CHANNEL_ID = "sanad_finance_alerts";
    public static final int REQ_NOTIFICATIONS = 405;

    private SanadReminderScheduler() {}

    public static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "SANAD financial alerts", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Budget, weekly summary and upcoming-payment alerts from SANAD");
        nm.createNotificationChannel(ch);
    }

    public static void ensureScheduled(Context c) {
        ensureChannel(c);
        AlarmManager am = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, SanadReminderReceiver.class).setAction(ACTION_DAILY);
        PendingIntent pi = PendingIntent.getBroadcast(c, 2601, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, 9);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
    }

    public static void requestPermissionIfNeeded(Activity a) {
        ensureChannel(a);
        if (Build.VERSION.SDK_INT >= 33 && a.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            a.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
        }
    }
}
