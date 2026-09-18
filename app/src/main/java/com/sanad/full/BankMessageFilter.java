package com.sanad.full;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

public final class BankMessageFilter {
    private static final Pattern SECURITY=Pattern.compile("(?iu)(?:\\b(?:otp|one[- ]?time|verification(?:\\s+code)?|password|passcode|pin|cvv|login|reset)\\b|رمز\\s*(?:التحقق|الدخول|سري|لمرة\\s*واحدة)|كلمة\\s*المرور|كلمه\\s*المرور|الرقم\\s*السري)");
    private static final Pattern MONEY=Pattern.compile("(?iu)(AED|SAR|USD|EUR|GBP|EGP|MAD|درهم|دراهم|ريال|ريالات|دولار|جنيه)\\s*[-+]?\\s*[0-9][0-9,.]*|[0-9][0-9,.]*\\s*(AED|SAR|USD|EUR|GBP|EGP|MAD|درهم|دراهم|ريال|ريالات|دولار|جنيه)");
    private static final Pattern TX=Pattern.compile("(?iu)(\\bused\\b|transaction|purchase|payment|paid|spent|charged|debit(?:ed)?|credited|received|withdraw(?:al|n)?|deposit(?:ed)?|transfer(?:red)?|cashback|\\bpos\\b|تم خصم|خصم|عملية شراء|تم إيداع|ايداع|إيداع|سحب|تحويل|دفعت|دفع|شراء)");
    private static final Pattern STATEMENT_ONLY=Pattern.compile("(?iu)(available\\s+balance|current\\s+balance|closing\\s+balance|credit\\s+limit|available\\s+credit|statement\\s+(?:amount|balance)|minimum\\s+due|amount\\s+due|payment\\s+due|الرصيد\\s+(?:المتاح|الحالي)|الحد\\s+الائتماني|المبلغ\\s+المستحق|الحد\\s+المتاح)");
    private static final Pattern ACTION=Pattern.compile("(?iu)(used\\s+for|was\\s+debited|debited|charged|paid|spent|purchase|withdrawn|credited|received|transferred|تم خصم|تم سحب|عملية شراء|تم إيداع|ايداع وارد|تحويل)");

    // Trusted notification sources: the current default SMS app plus verified UAE bank/wallet apps.
    private static final Set<String> TRUSTED_PACKAGES=new HashSet<>(Arrays.asList(
        "com.emiratesnbd.android",
        "com.emiratesislamic.android",
        "com.eitcfs.dupay",
        "com.fab.personalbanking",
        "com.adcb.bank",
        "com.adcb.nexgen",
        "com.vipera.ts.starter.MashreqAE"
    ));
    public static boolean isAllowedSourcePackage(String packageName,String defaultSmsPackage){
        if(packageName==null||packageName.trim().isEmpty()) return false;
        if(defaultSmsPackage!=null && packageName.equals(defaultSmsPackage)) return true;
        return TRUSTED_PACKAGES.contains(packageName);
    }
    // Exact source identities: notification key + original post time, or SMS row id + sender + message date.
    // This avoids collapsing two legitimate payments that happen to have the same text close together.
    public static String notificationFingerprint(String packageName,String notificationKey,int notificationId,String tag,String raw,long postedAt){
        long when=postedAt>0?postedAt:System.currentTimeMillis();
        String stable=(notificationKey!=null&&!notificationKey.isEmpty())?notificationKey:
                (String.valueOf(packageName)+"#"+notificationId+"#"+String.valueOf(tag)+"#"+String.valueOf(raw));
        return hash("notification|"+String.valueOf(packageName)+"|"+stable+"|"+when);
    }
    public static String messageFingerprint(String raw,long messageDate,long rowId,String sender){
        long when=messageDate>0?messageDate:System.currentTimeMillis();
        return hash("sms|"+rowId+"|"+when+"|"+String.valueOf(sender)+"|"+String.valueOf(raw));
    }
    private static String normalize(String s){
        if(s==null) return ""; StringBuilder b=new StringBuilder(s.length());
        for(int i=0;i<s.length();i++){
            char c=s.charAt(i);
            if(c>='٠'&&c<='٩') c=(char)('0'+(c-'٠')); else if(c>='۰'&&c<='۹') c=(char)('0'+(c-'۰'));
            else if(c=='٫') c='.'; else if(c=='٬') c=',';
            b.append(c);
        }
        return b.toString().replaceAll("\\s+"," ").trim();
    }
    public static boolean isFinancial(String text){
        String t=normalize(text);
        if(t.length()<8||SECURITY.matcher(t).find()) return false;
        if(!MONEY.matcher(t).find()||!TX.matcher(t).find()) return false;
        if(STATEMENT_ONLY.matcher(t).find()&&!ACTION.matcher(t).find()) return false;
        return true;
    }
    public static String hash(String s){ try{ String n=normalize(s).toLowerCase(Locale.ROOT); byte[] b=MessageDigest.getInstance("SHA-256").digest(n.getBytes(StandardCharsets.UTF_8)); StringBuilder x=new StringBuilder(); for(byte z:b)x.append(String.format(Locale.ROOT,"%02x",z)); return x.toString(); }catch(Exception e){return Integer.toHexString(String.valueOf(s).hashCode());} }
}
