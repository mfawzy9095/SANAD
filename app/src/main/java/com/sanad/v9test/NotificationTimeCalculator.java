package com.sanad.v9test;

import java.util.Calendar;
import java.util.TimeZone;

final class NotificationTimeCalculator {
    private NotificationTimeCalculator() {}

    static long nextTrigger(long nowMillis, int day, int month, int reminderDays, String frequency) {
        return nextTrigger(nowMillis, day, month, reminderDays, frequency, TimeZone.getDefault());
    }

    static long nextTrigger(long nowMillis, int day, int month, int reminderDays, String frequency, TimeZone timeZone) {
        TimeZone tz = timeZone == null ? TimeZone.getDefault() : timeZone;
        Calendar now = Calendar.getInstance(tz);
        now.setTimeInMillis(nowMillis);

        Calendar due = Calendar.getInstance(tz);
        due.setTimeInMillis(nowMillis);
        due.set(Calendar.HOUR_OF_DAY, 9);
        due.set(Calendar.MINUTE, 0);
        due.set(Calendar.SECOND, 0);
        due.set(Calendar.MILLISECOND, 0);

        int safeDay = Math.max(1, Math.min(28, day));
        int safeReminderDays = Math.max(0, Math.min(30, reminderDays));

        if ("yearly".equals(frequency)) {
            int safeMonth = Math.max(0, Math.min(11, month));
            due.set(Calendar.MONTH, safeMonth);
            due.set(Calendar.DAY_OF_MONTH, safeDay);
            for (int i = 0; i < 4; i++) {
                Calendar alert = (Calendar) due.clone();
                alert.add(Calendar.DAY_OF_MONTH, -safeReminderDays);
                if (alert.after(now)) return alert.getTimeInMillis();
                due.add(Calendar.YEAR, 1);
                due.set(Calendar.MONTH, safeMonth);
                due.set(Calendar.DAY_OF_MONTH, safeDay);
            }
        } else {
            due.set(Calendar.DAY_OF_MONTH, safeDay);
            for (int i = 0; i < 36; i++) {
                Calendar alert = (Calendar) due.clone();
                alert.add(Calendar.DAY_OF_MONTH, -safeReminderDays);
                if (alert.after(now)) return alert.getTimeInMillis();
                due.add(Calendar.MONTH, 1);
                due.set(Calendar.DAY_OF_MONTH, safeDay);
            }
        }

        return nowMillis + 60_000L;
    }
}
