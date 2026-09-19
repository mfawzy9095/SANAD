package com.sanad.full;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure-Java conservative parser for native SMS imports. */
public final class BankSmsParser {
    private BankSmsParser() {}

    public static final class Result {
        public final double amount;
        public final String currency;
        public final String type;
        public final long transactionAt;
        public final double confidence;
        public final String amountSource;
        Result(double amount,String currency,String type,long transactionAt,double confidence,String amountSource){
            this.amount=amount; this.currency=currency; this.type=type; this.transactionAt=transactionAt;
            this.confidence=confidence; this.amountSource=amountSource;
        }
    }

    private static final Pattern SECURITY=Pattern.compile("(?iu)(?:\\b(?:otp|one[- ]?time|verification(?:\\s+code)?|password|passcode|pin|cvv|login|reset)\\b|رمز\\s*(?:التحقق|الدخول|سري|لمرة\\s*واحدة)|كلمة\\s*المرور|كلمه\\s*المرور|الرقم\\s*السري)");
    private static final Pattern DECLINED=Pattern.compile("(?iu)(declined|failed|rejected|unsuccessful|insufficient|تم رفض|مرفوض|غير ناجح|رصيد غير كاف)");
    private static final Pattern STRONG_TX=Pattern.compile("(?iu)(used\\s+for|was\\s+debited|debited|charged|paid|spent|purchase|withdrawn|credited|received|transferred|deposit(?:ed)?|cashback|\\bpos\\b|تم خصم|تم سحب|عملية شراء|تم دفع|دفعت|تم إيداع|ايداع|إيداع|تحويل|استلمت)");
    private static final Pattern INCOME=Pattern.compile("(?iu)(credited|received|deposit(?:ed)?|cashback|salary|refund|تم إيداع|ايداع|إيداع|استلمت|راتب|مرتجع|استرداد)");
    private static final Pattern STATEMENT=Pattern.compile("(?iu)(minimum\\s+(?:amount\\s+)?due|amount\\s+due|payment\\s+due|statement\\s+(?:amount|balance)|credit\\s+limit|available\\s+credit|outstanding\\s+balance|available\\s+balance|current\\s+balance|closing\\s+balance|المبلغ\\s+المستحق|الحد\\s+الائتماني|كشف\\s+الحساب|الرصيد\\s+(?:المتاح|الحالي)|الحد\\s+المتاح)");
    private static final Pattern BAD_AMOUNT_CONTEXT=Pattern.compile("(?iu)(balance|available|limit|due|statement|outstanding|الرصيد|المتاح|الحد|المستحق|كشف)");
    private static final Pattern GOOD_AMOUNT_CONTEXT=Pattern.compile("(?iu)(debited|charged|paid|spent|purchase|withdrawn|credited|received|transferred|deposit|used|amount|تم خصم|تم سحب|عملية شراء|تم دفع|دفعت|تم إيداع|تحويل|مبلغ)");
    private static final String CUR="AED|DHS?|SAR|USD|EUR|GBP|EGP|MAD|درهم|دراهم|ريال|ريالات|دولار|يورو|جنيه|جنيهات";
    private static final Pattern CUR_BEFORE=Pattern.compile("(?iu)("+CUR+")\\s*[:=-]?\\s*([0-9][0-9,.]*(?:\\.[0-9]{1,2})?)");
    private static final Pattern CUR_AFTER=Pattern.compile("(?iu)([0-9][0-9,.]*(?:\\.[0-9]{1,2})?)\\s*("+CUR+")");

    private static final Map<String,Integer> MONTHS=new HashMap<>();
    static {
        String[][] a={{"jan","1"},{"january","1"},{"feb","2"},{"february","2"},{"mar","3"},{"march","3"},{"apr","4"},{"april","4"},{"may","5"},{"jun","6"},{"june","6"},{"jul","7"},{"july","7"},{"aug","8"},{"august","8"},{"sep","9"},{"sept","9"},{"september","9"},{"oct","10"},{"october","10"},{"nov","11"},{"november","11"},{"dec","12"},{"december","12"}};
        for(String[] x:a) MONTHS.put(x[0],Integer.parseInt(x[1]));
    }

    private static final class MoneyCandidate { double amount; String currency; int start,end,score; String source; }

    public static Result parse(String raw,long referenceMs){
        String text=normalize(raw);
        if(text.length()<8 || SECURITY.matcher(text).find() || DECLINED.matcher(text).find()) return null;
        boolean strong=STRONG_TX.matcher(text).find();
        if(!strong) return null;
        if(STATEMENT.matcher(text).find() && !hasTransactionalAction(text)) return null;

        List<MoneyCandidate> candidates=new ArrayList<>();
        collectMoney(text,CUR_BEFORE,true,candidates);
        collectMoney(text,CUR_AFTER,false,candidates);
        if(candidates.isEmpty()) return null;
        MoneyCandidate best=null;
        for(MoneyCandidate c:candidates){ scoreCandidate(text,c); if(best==null||c.score>best.score) best=c; }
        if(best==null||best.amount<=0||best.score<1) return null;

        long txAt=parseDate(text,referenceMs);
        String type=INCOME.matcher(text).find()&&!Pattern.compile("(?iu)(debited|charged|paid|spent|purchase|withdrawn|used\\s+for|تم خصم|تم سحب|عملية شراء|دفعت)").matcher(text).find()?"income":"expense";
        double confidence=Math.min(0.99,0.70 + (best.score>=7?0.20:best.score>=4?0.14:0.08) + (txAt>0?0.05:0));
        return new Result(best.amount,best.currency,type,txAt,confidence,best.source);
    }

    private static boolean hasTransactionalAction(String t){
        return Pattern.compile("(?iu)(debited|charged|paid|spent|purchase|withdrawn|credited|received|transferred|deposit(?:ed)?|used\\s+for|تم خصم|تم سحب|عملية شراء|تم دفع|دفعت|تم إيداع|تحويل)").matcher(t).find();
    }

    private static void collectMoney(String text,Pattern p,boolean currencyFirst,List<MoneyCandidate> out){
        Matcher m=p.matcher(text);
        while(m.find()){
            String cur=currencyFirst?m.group(1):m.group(2);
            String num=currencyFirst?m.group(2):m.group(1);
            double amount=parseNumber(num); if(!(amount>0)) continue;
            MoneyCandidate c=new MoneyCandidate(); c.amount=amount; c.currency=normalizeCurrency(cur); c.start=m.start(); c.end=m.end(); c.source="native_context"; out.add(c);
        }
    }

    private static void scoreCandidate(String text,MoneyCandidate c){
        int lo=Math.max(0,c.start-55), hi=Math.min(text.length(),c.end+55);
        String near=text.substring(lo,hi);
        c.score=2;
        if(GOOD_AMOUNT_CONTEXT.matcher(near).find()) c.score+=5;
        if(BAD_AMOUNT_CONTEXT.matcher(near).find()) c.score-=5;
        String very=text.substring(Math.max(0,c.start-22),Math.min(text.length(),c.end+22));
        if(GOOD_AMOUNT_CONTEXT.matcher(very).find()) c.score+=4;
        if(c.currency!=null) c.score+=1;
    }

    private static String normalizeCurrency(String c){
        String x=String.valueOf(c).trim().toUpperCase(Locale.ROOT);
        if(x.equals("DH")||x.equals("DHS")||x.startsWith("درهم")||x.startsWith("دراهم")) return "AED";
        if(x.startsWith("ريال")) return "SAR";
        if(x.startsWith("دولار")) return "USD";
        if(x.startsWith("يورو")) return "EUR";
        if(x.startsWith("جنيه")) return "EGP";
        return x.matches("AED|SAR|USD|EUR|GBP|EGP|MAD")?x:null;
    }

    private static double parseNumber(String s){
        try{return Double.parseDouble(s.replace(",",""));}catch(Exception e){return Double.NaN;}
    }

    public static long parseDate(String raw,long referenceMs){
        String s=normalize(raw); ZonedDateTime ref=ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(referenceMs>0?referenceMs:System.currentTimeMillis()), ZoneId.systemDefault());
        Matcher m;
        m=Pattern.compile("(?iu)(20\\d{2})[./-](\\d{1,2})[./-](\\d{1,2})(?:[^0-9]{0,8}(\\d{1,2})[:.](\\d{2})\\s*(am|pm)?)?").matcher(s);
        while(m.find()){ long v=makeDate(intg(m,1),intg(m,2),intg(m,3),intg(m,4),intg(m,5),group(m,6),referenceMs); if(v>0)return v; }
        m=Pattern.compile("(?iu)(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})(?:[^0-9]{0,8}(\\d{1,2})[:.](\\d{2})\\s*(am|pm)?)?").matcher(s);
        while(m.find()){ long v=makeDate(normYear(intg(m,3)),intg(m,2),intg(m,1),intg(m,4),intg(m,5),group(m,6),referenceMs); if(v>0)return v; }
        m=Pattern.compile("(?iu)(\\d{1,2})[- /](jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[- /](\\d{2,4})(?:[^0-9]{0,8}(\\d{1,2})[:.]?(\\d{2})?\\s*(am|pm)?)?").matcher(s);
        while(m.find()){ long v=makeDate(normYear(intg(m,3)),MONTHS.get(m.group(2).toLowerCase(Locale.ROOT)),intg(m,1),intg(m,4),intg(m,5),group(m,6),referenceMs); if(v>0)return v; }
        m=Pattern.compile("(?iu)(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+(\\d{1,2}),?\\s+(\\d{2,4})(?:[^0-9]{0,8}(\\d{1,2})[:.]?(\\d{2})?\\s*(am|pm)?)?").matcher(s);
        while(m.find()){ long v=makeDate(normYear(intg(m,3)),MONTHS.get(m.group(1).toLowerCase(Locale.ROOT)),intg(m,2),intg(m,4),intg(m,5),group(m,6),referenceMs); if(v>0)return v; }
        m=Pattern.compile("(?iu)(\\d{1,2})[./-](\\d{1,2})(?![./-]\\d)(?:[^0-9]{0,8}(\\d{1,2})[:.](\\d{2})\\s*(am|pm)?)?").matcher(s);
        while(m.find()){
            int day=intg(m,1),mon=intg(m,2),year=ref.getYear();
            try{ LocalDate d=LocalDate.of(year,mon,day); LocalDate rr=ref.toLocalDate(); if(d.isAfter(rr.plusDays(45)))year--; else if(d.isBefore(rr.minusDays(320)))year++; }catch(Exception ignored){}
            long v=makeDate(year,mon,day,intg(m,3),intg(m,4),group(m,5),referenceMs); if(v>0)return v;
        }
        return 0L;
    }

    private static long makeDate(int y,int mo,int d,int h,int mi,String ap,long referenceMs){
        if(h<0)h=0;if(mi<0)mi=0; String a=ap==null?"":ap.toLowerCase(Locale.ROOT); if(a.equals("pm")&&h<12)h+=12;if(a.equals("am")&&h==12)h=0;
        try{
            LocalDateTime ldt=LocalDateTime.of(y,mo,d,h,mi); long ms=ldt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
            if(referenceMs>0 && Math.abs(ms-referenceMs)>400L*24*60*60*1000) return 0L;
            return ms;
        }catch(Exception e){return 0L;}
    }
    private static int normYear(int y){return y<100?2000+y:y;}
    private static int intg(Matcher m,int i){try{String g=m.group(i);return g==null||g.isEmpty()?-1:Integer.parseInt(g);}catch(Exception e){return -1;}}
    private static String group(Matcher m,int i){try{return m.group(i);}catch(Exception e){return null;}}

    public static String normalize(String s){
        if(s==null)return ""; StringBuilder b=new StringBuilder(s.length());
        for(int i=0;i<s.length();i++){
            char c=s.charAt(i);
            if(c>='٠'&&c<='٩')c=(char)('0'+c-'٠'); else if(c>='۰'&&c<='۹')c=(char)('0'+c-'۰'); else if(c=='٫')c='.'; else if(c=='٬')c=',';
            b.append(c);
        }
        return b.toString().replaceAll("\\s+"," ").trim();
    }
}
