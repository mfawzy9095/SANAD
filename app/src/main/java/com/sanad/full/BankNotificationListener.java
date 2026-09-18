package com.sanad.full;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.provider.Telephony;

public class BankNotificationListener extends NotificationListenerService {
    @Override public void onNotificationPosted(StatusBarNotification sbn){
        try{
            String sourcePackage=sbn.getPackageName();
            String defaultSms=null;
            try{ defaultSms=Telephony.Sms.getDefaultSmsPackage(getApplicationContext()); }catch(Exception ignored){}
            if(!BankMessageFilter.isAllowedSourcePackage(sourcePackage,defaultSms)) return;
            Notification n=sbn.getNotification();
            if((n.flags & Notification.FLAG_GROUP_SUMMARY)!=0) return;
            Bundle e=n.extras;
            CharSequence title=e.getCharSequence(Notification.EXTRA_TITLE), text=e.getCharSequence(Notification.EXTRA_TEXT), big=e.getCharSequence(Notification.EXTRA_BIG_TEXT);
            String raw=((title==null?"":title.toString())+"\n"+(big!=null?big.toString():(text==null?"":text.toString()))).trim();
            if(!BankMessageFilter.isFinancial(raw)) return;
            String h=BankMessageFilter.notificationFingerprint(sourcePackage,sbn.getKey(),sbn.getId(),sbn.getTag(),raw,sbn.getPostTime()); SanadDatabase db=new SanadDatabase(getApplicationContext());
            if(!db.enqueueBankIfFresh(h,raw,sbn.getPostTime())) return;
            MainActivity.requestPendingBankDrainIfOpen();
        }catch(Exception ignored){}
    }
}
