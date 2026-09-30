package com.sanad.v9test;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

public final class NotificationReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String specJson = intent == null ? null : intent.getStringExtra("spec");
        if (specJson == null) return;
        try {
            JSONObject spec = new JSONObject(specJson);
            NotificationScheduler.showNow(
                    context,
                    spec.optString("id", "sanad"),
                    spec.optString("title", "SANAD"),
                    spec.optString("body", "")
            );
            NotificationScheduler.scheduleNextFromJson(context, specJson);
        } catch (Exception ignored) {}
    }
}
