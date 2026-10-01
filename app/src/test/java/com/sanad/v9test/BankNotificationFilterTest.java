package com.sanad.v9test;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class BankNotificationFilterTest {
    @Test
    public void acceptsRepresentativeEnbdFinancialMessages() {
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "Emirates NBD تمت عملية شراء في AED 13.50 AL FATHOUR GROCERY,SHARJAH على البطاقة 4021 الائتمان المتوفر AED4,171.36"));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "تم خصم AED 160.00 من حسابك 1801 لتحويل الأموال من خلال الخدمات المصرفية عبر الإنترنت."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "لقد تم ايداع AED 149.00 في رقم حسابك 012XXX50XXX01. الرصيد المتوفر هو AED 161.52"));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "تم ايداع الراتب AED 9,000.00 في حسابك 012XXX50XXX01"));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "تم خصم مبلغ AED 684.19 من حسابك 012XXX50XXX01 لتسديد مستحقات بطاقتك الائتمانية4021."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "تمت عملية شراء بقيمة AED 5.10 لدى NMC MED CEN SHJ BR باستخدام بطاقة خصم تنتهي أرقامها بـ 3993."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "لقد تم تحويل مبلغ 100.00AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*Mohamed."));
    }

    @Test
    public void rejectsNonCompletedAndSecurityMessages() {
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "يوجد لديك دفعة بطاقة تتطلب موافقتك. الرجاء تسجيل الدخول إلى تطبيق بنك الإمارات دبي الوطني."));
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "تم استبدال NOL Payment كعملية AED 153.00 على بطاقة MC TITANIUM بنجاح."));
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "Emirates NBD OTP 123456 for purchase AED 20.00. Do not share this verification code."));
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "WhatsApp Ahmed sent you a message."));
    }
}
