package com.sanad.v9test;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertFalse;

public class BankNotificationStoreTest {
    @Test
    public void redactsFullPanBeforePersistentInboxStorage() {
        assertEquals(
                "Card 4111 XXXX XXXX 1111 purchase AED 25.00",
                BankNotificationStore.redactSensitiveCardNumbers(
                        "Card 4111 1111 1111 1111 purchase AED 25.00"));
        assertEquals(
                "Card 4111 XXXX XXXX 1111 purchase AED 25.00",
                BankNotificationStore.redactSensitiveCardNumbers(
                        "Card 4111111111111111 purchase AED 25.00"));
    }

    @Test
    public void doesNotMaskNonPanReferenceNumbers() {
        assertEquals(
                "Transaction reference 1234567890123456",
                BankNotificationStore.redactSensitiveCardNumbers(
                        "Transaction reference 1234567890123456"));
        assertEquals(
                "Card 4578 XXXX XXXX 0308 purchase AED 10.00",
                BankNotificationStore.redactSensitiveCardNumbers(
                        "Card 4578 XXXX XXXX 0308 purchase AED 10.00"));
    }
    @Test
    public void inboxCapacityStopsInsteadOfEvictingReviewEvents() {
        assertFalse(BankNotificationStore.capacityReached(199));
        assertTrue(BankNotificationStore.capacityReached(200));
        assertTrue(BankNotificationStore.capacityReached(201));
    }
    @Test
    public void overflowPreservesHeadroomButNeverEvictsAtHardLimit() {
        assertFalse(BankNotificationStore.queueCanAccept(-1));
        assertTrue(BankNotificationStore.queueCanAccept(199));
        assertTrue(BankNotificationStore.queueCanAccept(200));
        assertTrue(BankNotificationStore.queueCanAccept(2199));
        assertFalse(BankNotificationStore.queueCanAccept(2200));
        assertFalse(BankNotificationStore.queueCanAccept(2201));
    }
}
