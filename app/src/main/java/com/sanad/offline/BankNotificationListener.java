package com.sanad.offline;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class BankNotificationListener extends NotificationListenerService {
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        Notification n = sbn.getNotification();
        if (n == null) return;
        Bundle e = n.extras;
        String title = e.getCharSequence(Notification.EXTRA_TITLE, "").toString();
        String text = e.getCharSequence(Notification.EXTRA_TEXT, "").toString();
        CharSequence big = e.getCharSequence(Notification.EXTRA_BIG_TEXT, "");
        String raw = (title + " " + text + " " + (big == null ? "" : big.toString())).trim();
        if (!FinanceParser.looksLikeBankPayment(raw)) return;
        Transaction tx = FinanceParser.parse(raw, "bank-notification:" + sbn.getPackageName());
        if (!tx.hasAmount() || tx.confidence < 0.90) return;
        DatabaseHelper db = new DatabaseHelper(getApplicationContext());
        if (!db.isDuplicate(tx, 10 * 60 * 1000L)) db.insert(tx);
        db.close();
    }
}
