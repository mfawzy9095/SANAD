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

    @Test
    public void acceptsArabicCreditCardAndDuPayCompletedTransactions() {
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "عملية دفع ببطاقة الائتمان المنتهية بالرقم: 0308 لدى: FRESH CRAFT MINI MART, DUBAI المبلغ: AED 2.50 التاريخ: 01/10/2026, 06:44 الحد المتوفر: 457.04 AED"));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "Your request to transfer AED 149.00 to Mohamed Abdelrahman Fawzy is successfully processed. TID: DIR7BQ7FZ3"));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "You've received AED 3,500.00 to your du Pay wallet. Your available balance is now AED 3,500.40."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "Your du Pay Card ending in 7105 has been used for AED 318.15 at Platinumlist. Your available balance is now AED 3,182.38."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "You have successfully withdrawn AED 100.00 from your du Pay wallet. Available balance: AED 10.28"));
    }

    @Test
    public void rejectsStatementsDeclinesAndCardLifecycleMessages() {
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "Credit Card Mini Statement Minimum Amount Due: AED 476.19 Amount to be paid to avoid charges: AED 3,509.97"));
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "Your transaction of AED 40.53 at Talabat on your du Pay Card ending in 7105 was declined due to insufficient Balance."));
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "نود تأكيد استلام دفعة AED 433.00 عن البطاقة الائتمانية التي تبدأ بالرقم 457828."));
        assertFalse(BankNotificationFilter.looksLikeCandidate(
                "Your du Pay Card ending in 7105 has been suspended from Google Pay."));
    }    @Test
    public void acceptsRechargeBillAndRefundFamilies() {
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "Mobile recharge AED 50.00 successfully processed."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "Bill payment AED 120.00 successfully processed."));
        assertTrue(BankNotificationFilter.looksLikeCandidate(
                "Refund AED 25.00 credited to your card."));
    }


    @Test
    public void handlesDiacriticsAndRejectsInstallmentOffers() {
        assertTrue(BankNotificationFilter.looksLikeCandidate("لقد تمّ تحويل مبلغ 1,068.70AED باستخدام بطاقة الخصم الخاصة بك والمنتهية أرقامها بـ 3993 لدى TAPT*TestRecipient."));
        assertTrue(BankNotificationFilter.looksLikeCandidate("لقد تم إعادة مبلغ عملية شراء بقيمة AED 38.00 إلى حساب بطاقتك."));
        assertFalse(BankNotificationFilter.looksLikeCandidate("*Convert now* Pay as low as AED 32.31 per month for the purchase of AED 1124.50 with credit card ending 4021"));
        assertFalse(BankNotificationFilter.looksLikeCandidate("رفض معاملة شراء لعدم وجود رصيد كاف المبلغ AED 185.66"));
    }
    @Test
    public void acceptsEgyptWalletUnitsAndUaeWalletFunding() {
        assertTrue(BankNotificationFilter.looksLikeCandidate("تم إيداع مبلغ 1800.00 ج.م إلى محفظتك. رصيد محفظتك الحالى 1800.00 ج.م"));
        assertTrue(BankNotificationFilter.looksLikeCandidate("تم شحن 25.00ج.م لرقمك من محفظة اتصالات كاش"));
        assertTrue(BankNotificationFilter.looksLikeCandidate("AED 10.00 added to your e& money using your card. Your updated balance is AED 10.35"));
        assertTrue(BankNotificationFilter.looksLikeCandidate("تم خصم MAD 20 من بطاقة الائتمان رقم 4093 عند GLOVO المتاح 19476.4 جم"));
    }
}
