package com.sanad.v9test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Calendar;
import java.util.TimeZone;

public final class NotificationTimeCalculatorTest {
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

    private static long at(int y, int m0, int d, int h, int min) {
        Calendar c = Calendar.getInstance(UTC);
        c.clear();
        c.set(y, m0, d, h, min, 0);
        return c.getTimeInMillis();
    }

    @Test
    public void monthlyBoundarySkipsAlreadyMissedReminderWindow() {
        long now = at(2026, Calendar.SEPTEMBER, 30, 12, 0);
        long actual = NotificationTimeCalculator.nextTrigger(now, 1, 0, 3, "monthly", UTC);
        long expected = at(2026, Calendar.OCTOBER, 29, 9, 0);
        assertEquals(expected, actual);
    }

    @Test
    public void monthlyFutureReminderUsesCurrentMonth() {
        long now = at(2026, Calendar.SEPTEMBER, 10, 12, 0);
        long actual = NotificationTimeCalculator.nextTrigger(now, 20, 0, 3, "monthly", UTC);
        long expected = at(2026, Calendar.SEPTEMBER, 17, 9, 0);
        assertEquals(expected, actual);
    }

    @Test
    public void yearlyBoundaryAdvancesUntilReminderIsFuture() {
        long now = at(2026, Calendar.DECEMBER, 31, 12, 0);
        long actual = NotificationTimeCalculator.nextTrigger(now, 2, Calendar.JANUARY, 5, "yearly", UTC);
        long expected = at(2027, Calendar.DECEMBER, 28, 9, 0);
        assertEquals(expected, actual);
    }

    @Test
    public void resultIsAlwaysFutureForSupportedInputs() {
        long now = at(2026, Calendar.SEPTEMBER, 30, 12, 0);
        for (int day = 1; day <= 28; day += 3) {
            for (int reminder = 0; reminder <= 30; reminder += 5) {
                long actual = NotificationTimeCalculator.nextTrigger(now, day, 0, reminder, "monthly", UTC);
                assertTrue(actual > now);
            }
        }
    }
}
