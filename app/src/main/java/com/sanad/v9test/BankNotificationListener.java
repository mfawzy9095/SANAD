package com.sanad.v9test;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public final class BankNotificationListener extends NotificationListenerService {
    private static volatile BankNotificationListener activeInstance;

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        activeInstance = this;
        scanActiveNotifications();
    }

    @Override
    public void onListenerDisconnected() {
        if (activeInstance == this) activeInstance = null;
        super.onListenerDisconnected();
    }

    @Override
    public void onDestroy() {
        if (activeInstance == this) activeInstance = null;
        super.onDestroy();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        capture(sbn);
    }

    public static boolean isConnected() {
        return activeInstance != null;
    }

    public static int rescanActiveNow() {
        BankNotificationListener current = activeInstance;
        if (current == null) return -1;
        return current.scanActiveNotifications();
    }

    public static void requestReconnect(Context context) {
        if (context == null) return;
        try {
            NotificationListenerService.requestRebind(
                    new ComponentName(context, BankNotificationListener.class)
            );
        } catch (Exception ignored) {}
    }

    private int scanActiveNotifications() {
        int added = 0;
        try {
            StatusBarNotification[] rows = getActiveNotifications();
            if (rows == null) return 0;
            for (StatusBarNotification sbn : rows) {
                if (capture(sbn)) added++;
            }
        } catch (Exception ignored) {}
        return added;
    }

    private boolean capture(StatusBarNotification sbn) {
        if (sbn == null || getPackageName().equals(sbn.getPackageName())) return false;
        Notification notification = sbn.getNotification();
        if (notification == null) return false;

        Bundle extras = notification.extras;
        if (extras == null) return false;

        String title = charText(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = charText(extras.getCharSequence(Notification.EXTRA_TEXT));
        String big = charText(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String body = mergeBody(text, big);
        String probe = (title + " " + body).trim();

        if (!BankNotificationFilter.looksLikeCandidate(probe)) return false;

        return BankNotificationStore.enqueue(
                getApplicationContext(),
                sbn.getPackageName(),
                title,
                body,
                sbn.getPostTime()
        );
    }

    private static String charText(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }

    static String mergeBody(String text, String big) {
        String a = text == null ? "" : text.trim();
        String b = big == null ? "" : big.trim();
        if (b.isEmpty()) return a;
        if (a.isEmpty() || b.equals(a)) return b;
        if (b.contains(a)) return b;
        return a + "\n" + b;
    }
}
