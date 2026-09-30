package com.sanad.v9test;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
                "android.intent.action.MY_PACKAGE_REPLACED".equals(action)) {
            NotificationScheduler.rescheduleStored(context);
        }
    }
}
