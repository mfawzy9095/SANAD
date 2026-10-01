package com.sanad.v9test;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public final class BankNotificationListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = charText(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = charText(extras.getCharSequence(Notification.EXTRA_TEXT));
        String big = charText(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String body = mergeBody(text, big);
        String probe = (title + " " + body).trim();

        if (!BankNotificationFilter.looksLikeCandidate(probe)) return;

        BankNotificationStore.enqueue(
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
