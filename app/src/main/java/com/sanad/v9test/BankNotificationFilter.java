package com.sanad.v9test;

import java.util.Locale;
import java.util.regex.Pattern;

public final class BankNotificationFilter {
    private BankNotificationFilter() {}

    private static final Pattern MONEY = Pattern.compile(
            "(?i)(?:AED|USD|EUR|GBP|SAR|EGP|MAD)\\s*[0-9][0-9,.]*|[0-9][0-9,.]*\\s*(?:AED|USD|EUR|GBP|SAR|EGP|MAD)"
    );

    public static boolean looksLikeCandidate(String raw) {
        if (raw == null) return false;
        String x = normalize(raw);
        if (x.isEmpty() || x.length() > 12000) return false;

        if (containsAny(x,
                "otp", "one time password", "verification code", "security code",
                "convert now", "pay as low as", "is being processed", "is processing",
                "تعذر اتمام", "رفض معامله", "has been declined",
                "رمز التحقق", "كلمة مرور لمرة", "كلمه مرور لمره",
                "دفعة بطاقة تتطلب موافقتك", "دفعه بطاقه تتطلب موافقتك",
                "requires your approval", "pending approval", "authorization required",
                "تم استبدال", "rewards redemption", "reward redemption",
                "credit card mini statement", "minimum amount due",
                "was declined", "declined due to", "transaction declined",
                "نود تاكيد استلام دفعه", "نود تاكيد استلام دفعة",
                "has been suspended", "has been resumed", "request to freeze",
                "successfully reactivated", "registered in google pay", "تم تسجيل بطاقتك")) {
            return false;
        }

        if (!MONEY.matcher(x).find()) return false;

        return containsAny(x,
                "تمت عملية شراء", "تمت عمليه شراء", "عملية شراء", "عمليه شراء",
                "تم خصم", "خصم مبلغ", "تم ايداع", "تم إيداع", "ايداع الراتب", "إيداع الراتب",
                "تم تحويل مبلغ", "تحويل الأموال", "تحويل الاموال", "لتسديد مستحقات",
                "purchase", "purchased", "card purchase", "pos", "merchant",
                "debited", "debit", "credited", "credit", "salary", "payroll",
                "deposit", "transfer", "payment", "عملية دفع", "عمليه دفع",
                "has been used for", "you've received", "you’ve received", "received aed",
                "successfully withdrawn", "withdrawn",
                "recharge", "top up", "top-up", "airtime", "شحن رصيد",
                "bill payment", "paid bill", "دفع فاتورة", "سداد فاتورة",
                "refund", "refunded", "reversal", "reversed", "استرداد", "تم اعاده مبلغ", "تم عكس");
    }

    private static boolean containsAny(String x, String... terms) {
        for (String term : terms) {
            if (x.contains(normalize(term))) return true;
        }
        return false;
    }

    static String normalize(String value) {
        String s = value.toLowerCase(Locale.ROOT)
                .replace('٠','0').replace('١','1').replace('٢','2').replace('٣','3').replace('٤','4')
                .replace('٥','5').replace('٦','6').replace('٧','7').replace('٨','8').replace('٩','9')
                .replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي');
        return s.replaceAll("[\\u064b-\\u065f\\u0670]", "").replaceAll("\\s+", " ").trim();
    }
}
