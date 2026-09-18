package com.sanad.full;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class SanadReminderReceiver extends BroadcastReceiver {
    private static final String PREF = "sanad_reminder_state";

    @Override public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent == null ? null : intent.getAction())) {
            SanadReminderScheduler.ensureScheduled(context);
            return;
        }
        SanadReminderScheduler.ensureScheduled(context);
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            String raw = new SanadDatabase(context).loadState();
            if (raw == null || raw.trim().isEmpty()) return;
            evaluate(context, new JSONObject(raw));
        } catch (Exception ignored) {}
    }

    private void evaluate(Context c, JSONObject state) throws Exception {
        JSONObject settings = state.optJSONObject("settings");
        if (settings == null) return;
        JSONObject notif = settings.optJSONObject("notif");
        if (notif == null) return;
        boolean ar = "ar".equals(settings.optString("language", "ar"));
        String base = settings.optString("baseCurrency", "AED");
        int startDay = Math.max(1, Math.min(28, settings.optInt("monthStartDay", 1)));
        LocalDate now = LocalDate.now();
        LocalDate cycleStart = now.getDayOfMonth() >= startDay ? now.withDayOfMonth(startDay) : now.minusMonths(1).withDayOfMonth(startDay);
        LocalDate cycleEnd = cycleStart.plusMonths(1);
        JSONObject budgets = state.optJSONObject("budgets");
        double budget = budgets == null ? 0 : Math.max(0, budgets.optDouble("monthly", 0));
        JSONArray txs = state.optJSONArray("transactions");
        double spent = 0, weekSpent = 0;
        LocalDate weekAgo = now.minusDays(6);
        if (txs != null) for (int i=0;i<txs.length();i++) {
            JSONObject tx = txs.optJSONObject(i); if (tx == null || !"expense".equals(tx.optString("type"))) continue;
            LocalDate d = txDate(tx.optString("date", "")); if (d == null) continue;
            double amount = baseAmount(tx, base);
            if (!d.isBefore(cycleStart) && d.isBefore(cycleEnd)) spent += amount;
            if (!d.isBefore(weekAgo) && !d.isAfter(now)) weekSpent += amount;
        }
        SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        if (notif.optBoolean("budget", true) && budget > 0) {
            double ratio = spent / budget;
            int threshold = ratio >= 1.0 ? 100 : (ratio >= 0.85 ? 85 : 0);
            String key = cycleStart + ":" + threshold;
            if (threshold > 0 && !key.equals(p.getString("budget_key", ""))) {
                String title = ar ? "تنبيه الميزانية" : "Budget alert";
                String body = ar ? "استخدمت " + Math.round(ratio*100) + "% من ميزانية الدورة الحالية." : "You have used " + Math.round(ratio*100) + "% of the current cycle budget.";
                notify(c, 2602, title, body);
                p.edit().putString("budget_key", key).apply();
            }
        }
        if (notif.optBoolean("weekly", true) && now.getDayOfWeek().getValue() == 1) {
            String key = now.toString();
            if (!key.equals(p.getString("weekly_key", ""))) {
                String title = ar ? "ملخص سند الأسبوعي" : "SANAD weekly summary";
                String body = ar ? "مصروف آخر 7 أيام: " + money(weekSpent, base) : "Last 7 days spending: " + money(weekSpent, base);
                notify(c, 2603, title, body);
                p.edit().putString("weekly_key", key).apply();
            }
        }
        if (notif.optBoolean("ai", true)) {
            double upcoming = upcomingWithin(state, now, 3);
            String key = now + ":" + Math.round(upcoming);
            if (upcoming > 0 && !key.equals(p.getString("upcoming_key", ""))) {
                String title = ar ? "التزامات قريبة" : "Upcoming commitments";
                String body = ar ? "خلال 3 أيام عندك التزامات مخططة بحوالي " + money(upcoming, base) : "Planned commitments in the next 3 days: about " + money(upcoming, base);
                notify(c, 2604, title, body);
                p.edit().putString("upcoming_key", key).apply();
            }
        }
    }

    private static LocalDate txDate(String iso) {
        try { return Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate(); }
        catch (DateTimeParseException e) { try { return LocalDate.parse(iso.length() >= 10 ? iso.substring(0,10) : iso); } catch (Exception ignored) { return null; } }
    }

    private static double upcomingWithin(JSONObject state, LocalDate now, int days) {
        LocalDate limit = now.plusDays(days); double total = 0;
        JSONArray recurring = state.optJSONArray("recurring");
        if (recurring != null) for (int i=0;i<recurring.length();i++) {
            JSONObject r=recurring.optJSONObject(i); if(r==null) continue;
            LocalDate d=nextDay(now,Math.max(1,Math.min(28,r.optInt("day",1))));
            if(!d.isAfter(limit)) total+=Math.max(0,r.optDouble("amount",0));
        }
        JSONArray debts = state.optJSONArray("debts");
        if (debts != null) for (int i=0;i<debts.length();i++) {
            JSONObject d0=debts.optJSONObject(i); if(d0==null) continue;
            LocalDate d=nextDay(now,Math.max(1,Math.min(28,d0.optInt("dueDay",1))));
            if(!d.isAfter(limit)) total+=Math.max(0,d0.optDouble("minPayment",0));
        }
        return total;
    }

    private static LocalDate nextDay(LocalDate now,int day){
        LocalDate d=now.withDayOfMonth(Math.min(day,now.lengthOfMonth()));
        if(d.isBefore(now)) { LocalDate m=now.plusMonths(1); d=m.withDayOfMonth(Math.min(day,m.lengthOfMonth())); }
        return d;
    }

    private static double baseAmount(JSONObject tx, String target) {
        double v = tx.optDouble("baseAmount", tx.optDouble("amount",0));
        String from = tx.optString("baseCurrency", tx.optString("currency", target));
        return v * rate(from,target);
    }

    private static double rate(String a,String b){
        if(a.equals(b)) return 1;
        Map<String,Double> m=Rates.HOLDER; Double x=m.get(a),y=m.get(b); if(x==null||y==null) return 1; return y/x;
    }
    private static final class Rates {
        static final Map<String,Double> HOLDER=new HashMap<>();
        static { HOLDER.put("AED",3.6725); HOLDER.put("USD",1.0); HOLDER.put("EUR",0.92); HOLDER.put("GBP",0.79); HOLDER.put("SAR",3.75); HOLDER.put("EGP",48.5); HOLDER.put("MAD",9.9); HOLDER.put("JPY",151.3); HOLDER.put("CAD",1.36); HOLDER.put("AUD",1.52); }
    }

    private static String money(double v,String c){ return String.format(Locale.US,"%.0f %s",v,c); }

    private static void notify(Context c,int id,String title,String body){
        SanadReminderScheduler.ensureChannel(c);
        Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi=PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,SanadReminderScheduler.CHANNEL_ID):new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi);
        NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE); if(nm!=null) nm.notify(id,b.build());
    }
}
