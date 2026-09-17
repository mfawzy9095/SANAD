package com.sanad.offline;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class FinanceParser {
    private FinanceParser() {}

    private static final Map<String, Integer> UNITS = new HashMap<>();
    private static final Map<String, Integer> TENS = new HashMap<>();
    private static final Map<String, String> MERCHANTS = new LinkedHashMap<>();
    private static final Map<String, String> MERCHANT_CATS = new HashMap<>();

    static {
        String[][] u = {
                {"صفر","0"},{"واحد","1"},{"واحده","1"},{"واحدة","1"},{"اتنين","2"},{"اثنين","2"},{"اثنان","2"},{"اثنتين","2"},
                {"تلاته","3"},{"ثلاثه","3"},{"ثلاثة","3"},{"اربعه","4"},{"اربعة","4"},{"اربعة","4"},{"خمسه","5"},{"خمسة","5"},
                {"سته","6"},{"ستة","6"},{"سبعه","7"},{"سبعة","7"},{"تمانيه","8"},{"ثمانيه","8"},{"ثمانية","8"},{"تسعه","9"},{"تسعة","9"}
        };
        for (String[] e : u) UNITS.put(norm(e[0]), Integer.parseInt(e[1]));
        String[][] t = {
                {"عشره","10"},{"عشرة","10"},{"عشرين","20"},{"تلاتين","30"},{"ثلاثين","30"},{"اربعين","40"},{"خمسين","50"},
                {"ستين","60"},{"سبعين","70"},{"تمانين","80"},{"ثمانين","80"},{"تسعين","90"}
        };
        for (String[] e : t) TENS.put(norm(e[0]), Integer.parseInt(e[1]));

        addMerchant("Noon", "shopping", "نون", "noon");
        addMerchant("Noon Food", "food", "نون فود", "noon food");
        addMerchant("Carrefour", "groceries", "كارفور", "carrefour");
        addMerchant("Careem", "transport", "كريم", "careem");
        addMerchant("Uber", "transport", "اوبر", "أوبر", "uber");
        addMerchant("Talabat", "food", "طلبات", "talabat");
        addMerchant("Deliveroo", "food", "دليفرو", "deliveroo");
        addMerchant("Starbucks", "food", "ستاربكس", "starbucks");
        addMerchant("Amazon", "shopping", "امازون", "amazon");
        addMerchant("Lulu", "groceries", "لولو", "lulu");
        addMerchant("Spinneys", "groceries", "سبينس", "spinneys");
        addMerchant("IKEA", "home", "ايكيا", "ikea");
        addMerchant("Netflix", "subscriptions", "نتفلكس", "نتفليكس", "netflix");
        addMerchant("Spotify", "subscriptions", "سبوتيفاي", "spotify");
        addMerchant("VOX Cinemas", "entertainment", "فوكس", "سينما", "vox");
        addMerchant("Pharmacy", "health", "صيدليه", "صيدلية", "pharmacy");
    }

    private static void addMerchant(String canonical, String cat, String... aliases) {
        MERCHANT_CATS.put(canonical, cat);
        for (String a : aliases) MERCHANTS.put(norm(a), canonical);
    }

    public static Transaction parse(String raw, String source) {
        Transaction tx = new Transaction();
        tx.rawText = raw == null ? "" : raw.trim();
        tx.source = source == null ? "manual" : source;
        String x = norm(tx.rawText);

        tx.income = containsAny(x, "راتب", "مرتب", "salary", "payroll", "دخل", "استلمت", "وصلني", "refund", "استرداد", "cashback");
        tx.currency = detectCurrency(x);
        Double numeric = firstNumericAmount(x);
        if (numeric == null) numeric = arabicWordAmount(x);
        if (numeric != null) tx.amount = numeric;

        for (Map.Entry<String,String> e : MERCHANTS.entrySet()) {
            String alias = e.getKey();
            if (containsWhole(x, alias)) {
                if ("كريم".equals(alias) && (x.contains("ايس كريم") || x.contains("ايسكريم"))) continue;
                tx.merchant = e.getValue();
                break;
            }
        }

        tx.category = detectCategory(x, tx.merchant, tx.income);
        tx.note = detectNote(x, tx);
        tx.txTime = detectRelativeDate(x);

        double c = 0.20;
        if (tx.amount > 0) c += 0.38;
        if (tx.currency != null && !tx.currency.isEmpty()) c += 0.08;
        if (!tx.merchant.isEmpty()) c += 0.14;
        if (!"other".equals(tx.category)) c += 0.12;
        if (tx.income) c += 0.04;
        if (source != null && source.startsWith("bank")) c += 0.06;
        tx.confidence = Math.min(0.99, c);
        return tx;
    }

    public static boolean looksLikeBankPayment(String raw) {
        String x = norm(raw);
        boolean hasMoney = x.matches(".*(?:aed|درهم|sar|ريال|usd|دولار)\\s*\\d.*") || x.matches(".*\\d+(?:[.,]\\d+)?\\s*(?:aed|درهم|sar|ريال|usd|دولار).*");
        boolean signal = containsAny(x, "card", "بطاق", "purchase", "purchased", "used for", "transaction", "تم استخدام", "تم خصم", "تمت عمليه", "تمت عملية", "pos", "debit");
        return hasMoney && signal;
    }

    private static String detectCurrency(String x) {
        if (containsAny(x, "aed", "درهم", "دراهم")) return "AED";
        if (containsAny(x, "sar", "ريال", "ريالات")) return "SAR";
        if (containsAny(x, "egp", "جنيه", "جنيهات")) return "EGP";
        if (containsAny(x, "usd", "دولار", "دولارات")) return "USD";
        if (containsAny(x, "eur", "يورو")) return "EUR";
        if (containsAny(x, "mad", "درهم مغربي")) return "MAD";
        return "AED";
    }

    private static Double firstNumericAmount(String x) {
        Pattern p1 = Pattern.compile("(?:aed|sar|egp|usd|eur|mad|درهم(?:ات)?|ريال(?:ات)?|جنيه(?:ات)?|دولار(?:ات)?|يورو)\\s*([0-9]+(?:[.,][0-9]+)?)");
        Matcher m = p1.matcher(x);
        if (m.find()) return toDouble(m.group(1));
        Pattern p2 = Pattern.compile("([0-9]+(?:[.,][0-9]+)?)\\s*(?:aed|sar|egp|usd|eur|mad|درهم(?:ات)?|ريال(?:ات)?|جنيه(?:ات)?|دولار(?:ات)?|يورو)");
        m = p2.matcher(x);
        if (m.find()) return toDouble(m.group(1));
        Pattern p3 = Pattern.compile("(?:^|\\s)([0-9]+(?:[.,][0-9]+)?)(?:\\s|$)");
        m = p3.matcher(x);
        if (m.find()) return toDouble(m.group(1));
        return null;
    }

    private static double toDouble(String s) {
        try { return Double.parseDouble(s.replace(',', '.')); } catch (Exception e) { return 0; }
    }

    private static Double arabicWordAmount(String x) {
        String[] toks = x.replace("و", " و ").split("\\s+");
        double best = -1;
        for (int start = 0; start < toks.length; start++) {
            int total = 0, current = 0, used = 0;
            for (int i = start; i < toks.length && i < start + 8; i++) {
                String t = toks[i].trim();
                if (t.isEmpty() || "و".equals(t)) continue;
                Integer u = UNITS.get(t), ten = TENS.get(t);
                if (u != null) { current += u; used++; }
                else if (ten != null) { current += ten; used++; }
                else if (t.equals("ميه") || t.equals("مائه") || t.equals("مئة") || t.equals("ماية")) { current = Math.max(1,current) * 100; used++; }
                else if (t.equals("مئتين") || t.equals("ميتين")) { current += 200; used++; }
                else if (t.equals("الف") || t.equals("ألف")) { total += Math.max(1,current) * 1000; current = 0; used++; }
                else break;
            }
            if (used > 0) best = Math.max(best, total + current);
        }
        return best >= 0 ? best : null;
    }

    private static String detectCategory(String x, String merchant, boolean income) {
        if (income) return "income";
        if (merchant != null && MERCHANT_CATS.containsKey(merchant)) return MERCHANT_CATS.get(merchant);
        if (containsAny(x, "اكل", "أكل", "قهوه", "قهوة", "ايس كريم", "آيس كريم", "مطعم", "بيتزا", "برجر", "ساندوتش")) return "food";
        if (containsAny(x, "عيش", "خبز", "لبن", "حليب", "جبنه", "جبنة", "خضار", "فاكهه", "بقاله", "بقالة")) return "groceries";
        if (containsAny(x, "اوبر", "كريم", "تاكسي", "باص", "مترو", "بنزين", "وقود", "مواصل")) return "transport";
        if (containsAny(x, "فاتوره", "فاتورة", "كهربا", "كهرباء", "مياه", "انترنت", "نت", "اتصالات")) return "bills";
        if (containsAny(x, "دواء", "صيدليه", "صيدلية", "دكتور", "طبيب", "مستشفى")) return "health";
        if (containsAny(x, "نتفلكس", "سبوتيفاي", "اشتراك")) return "subscriptions";
        if (containsAny(x, "سينما", "لعب", "ترفيه")) return "entertainment";
        if (containsAny(x, "ايكيا", "اثاث", "أثاث", "منزل", "بيت")) return "home";
        if (containsAny(x, "اشتريت", "شوبنج", "تسوق", "ملابس", "هدوم", "امازون", "نون")) return "shopping";
        return "other";
    }

    private static long detectRelativeDate(String x) {
        Calendar c = Calendar.getInstance();
        if (containsAny(x, "اول امبارح", "أول امبارح", "اول امس", "أول أمس")) c.add(Calendar.DAY_OF_YEAR, -2);
        else if (containsAny(x, "امبارح", "امس", "أمس", "yesterday")) c.add(Calendar.DAY_OF_YEAR, -1);
        return c.getTimeInMillis();
    }

    private static String detectNote(String x, Transaction tx) {
        String n = x;
        for (String alias : MERCHANTS.keySet()) n = n.replace(alias, " ");
        n = n.replaceAll("[0-9]+(?:[.,][0-9]+)?", " ");
        String[] stop = {"دفعت","صرفت","اشتريت","جبت","من","في","على","علي","ب","aed","sar","egp","usd","eur","درهم","دراهم","ريال","جنيه","دولار","اليوم","امبارح","امس","أمس","و"};
        for (String s : stop) n = n.replaceAll("(^|\\s)"+Pattern.quote(norm(s))+"(?=\\s|$)", " ");
        for (String k : UNITS.keySet()) n = n.replaceAll("(^|\\s)"+Pattern.quote(k)+"(?=\\s|$)", " ");
        for (String k : TENS.keySet()) n = n.replaceAll("(^|\\s)"+Pattern.quote(k)+"(?=\\s|$)", " ");
        n = n.replaceAll("\\s+", " ").trim();
        return n.length() > 70 ? n.substring(0,70) : n;
    }

    private static boolean containsAny(String x, String... terms) {
        for (String s : terms) if (x.contains(norm(s))) return true;
        return false;
    }

    private static boolean containsWhole(String x, String phrase) {
        return (" " + x + " ").contains(" " + phrase + " ");
    }

    public static String norm(String input) {
        if (input == null) return "";
        String s = input.toLowerCase(Locale.ROOT)
                .replace('٠','0').replace('١','1').replace('٢','2').replace('٣','3').replace('٤','4')
                .replace('٥','5').replace('٦','6').replace('٧','7').replace('٨','8').replace('٩','9');
        s = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        s = s.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي').replace('ؤ','و').replace('ئ','ي');
        s = s.replaceAll("[^a-z0-9\\u0600-\\u06FF., ]", " ");
        return s.replaceAll("\\s+", " ").trim();
    }
}
